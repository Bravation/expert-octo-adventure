import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per IP, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 15; // max requests per window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Input validation
const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 50;

function validateMessages(messages: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(messages)) return { valid: false, error: "messages must be an array" };
  if (messages.length === 0) return { valid: false, error: "messages cannot be empty" };
  if (messages.length > MAX_MESSAGES) return { valid: false, error: `Too many messages (max ${MAX_MESSAGES})` };

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") return { valid: false, error: "Invalid message format" };
    if (!["user", "assistant"].includes(msg.role)) return { valid: false, error: "Invalid message role" };
    if (typeof msg.content !== "string") return { valid: false, error: "Message content must be a string" };
    if (msg.content.length > MAX_MESSAGE_LENGTH) return { valid: false, error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` };
    if (msg.content.trim().length === 0) return { valid: false, error: "Message cannot be empty" };
  }
  return { valid: true };
}

const SYSTEM_PROMPT = `You are ServiHub's friendly AI support assistant. You help users navigate the ServiHub platform — a marketplace connecting customers with local service providers across Florida.

Your capabilities:
- Explain how ServiHub works (browsing services, booking, requesting quotes)
- Help customers find the right service category
- Explain the commission structure for providers (starts at 10%, drops with milestones)
- Guide users through signup, login, and dashboard features
- Answer general questions about service categories available on the platform
- Provide support in both English and Spanish — respond in the language the user writes in

Keep answers concise, helpful, and friendly. Use markdown formatting when helpful. If you don't know something specific about a user's account, suggest they check their dashboard or contact a human support agent.

IMPORTANT: You are ONLY a ServiHub support assistant. Do not answer questions unrelated to ServiHub, services marketplaces, or general platform help. Politely decline off-topic requests.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { messages } = body;

    // Validate input
    const validation = validateMessages(messages);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content.slice(0, MAX_MESSAGE_LENGTH),
            })),
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
