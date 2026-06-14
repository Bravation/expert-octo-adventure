import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;

    const body = await req.json().catch(() => ({}));
    const env: StripeEnv = body?.env === "live" ? "live" : "sandbox";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: profile } = await admin.from("profiles").select("id").eq("user_id", userId).single();
    if (!profile) {
      return new Response(JSON.stringify({ connected: false }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: row } = await admin
      .from("connect_accounts")
      .select("*")
      .eq("provider_id", profile.id)
      .eq("environment", env)
      .maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ connected: false }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = createStripeClient(env);
    const account = await stripe.accounts.retrieve(row.stripe_account_id);

    const updated = {
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted,
      requirements: (account.requirements ?? {}) as any,
    };
    await admin.from("connect_accounts").update(updated).eq("id", row.id);

    return new Response(JSON.stringify({ connected: true, ...updated, stripe_account_id: row.stripe_account_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-connect-status error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
