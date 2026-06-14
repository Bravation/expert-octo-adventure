import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { subject, message } = await req.json();
    if (!subject || !message) throw new Error("Subject and message are required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Call AI to analyze the feedback
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a customer support AI for a service marketplace platform. Analyze the user's feedback/suggestion and respond with a helpful, empathetic acknowledgment. You must also categorize the feedback and detect the sentiment.

Your response must call the analyze_feedback function with the results.`
          },
          {
            role: "user",
            content: `Subject: ${subject}\n\nMessage: ${message}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_feedback",
              description: "Analyze and respond to user feedback",
              parameters: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    enum: ["bug_report", "feature_request", "complaint", "praise", "question", "general"],
                    description: "Category of the feedback"
                  },
                  sentiment: {
                    type: "string",
                    enum: ["positive", "neutral", "negative"],
                    description: "Sentiment of the feedback"
                  },
                  response: {
                    type: "string",
                    description: "A helpful, empathetic response to the user (2-4 sentences)"
                  }
                },
                required: ["category", "sentiment", "response"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_feedback" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI service quota exceeded." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let category = "general";
    let sentiment = "neutral";
    let aiReply = "Thank you for your feedback! We've received your suggestion and will review it carefully.";

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        category = parsed.category || category;
        sentiment = parsed.sentiment || sentiment;
        aiReply = parsed.response || aiReply;
      } catch { /* use defaults */ }
    }

    // Save to database
    const { data, error } = await supabase
      .from("suggestions")
      .insert({
        user_id: user.id,
        subject,
        message,
        category,
        sentiment,
        ai_response: aiReply,
        status: "reviewed",
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ suggestion: data, ai_response: aiReply, category, sentiment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-suggestion error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
