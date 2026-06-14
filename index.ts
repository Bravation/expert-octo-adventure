import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { computeAmounts } from "../_shared/fees.ts";

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

    const body = await req.json();
    const bookingId = body?.booking_id as string;
    const env: StripeEnv = body?.env === "live" ? "live" : "sandbox";
    const origin = req.headers.get("origin") || body?.origin || "https://example.com";
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "booking_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load booking and verify caller is the customer
    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, customer_id, provider_id, service_id, service_price, services(title)")
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerProfile } = await admin.from("profiles").select("id, email").eq("user_id", userId).single();
    if (!callerProfile || callerProfile.id !== booking.customer_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Provider Connect account
    const { data: connect } = await admin
      .from("connect_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("provider_id", booking.provider_id)
      .eq("environment", env)
      .maybeSingle();
    if (!connect?.stripe_account_id || !connect.charges_enabled) {
      return new Response(JSON.stringify({ error: "Provider is not ready to accept Stripe payments" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Look up provider's current commission rate from milestone tier (15% → 5%, step every 20 completed bookings)
    const { data: milestone } = await admin
      .from("provider_milestones")
      .select("current_commission_rate")
      .eq("provider_id", booking.provider_id)
      .maybeSingle();
    const commissionRatePct = Number(milestone?.current_commission_rate ?? 15);

    const amounts = computeAmounts(Number(booking.service_price), commissionRatePct);
    const stripe = createStripeClient(env);

    const serviceTitle = (booking as any).services?.title || "Service";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: callerProfile.email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amounts.customerChargeCents,
          product_data: { name: serviceTitle },
        },
      }],
      payment_intent_data: {
        application_fee_amount: amounts.applicationFeeCents,
        transfer_data: { destination: connect.stripe_account_id },
        metadata: { booking_id: bookingId },
      },
      metadata: { booking_id: bookingId },
      success_url: `${origin}/booking-payment-return?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/booking-payment-return?booking_id=${bookingId}&cancelled=1`,
    });

    await admin.from("bookings").update({
      payment_provider: "stripe",
      stripe_checkout_session_id: session.id,
      customer_total_charged: amounts.customerCharge,
      provider_net_amount: amounts.providerNet,
      platform_fee_amount: amounts.platformNet,
      stripe_fee_amount: amounts.stripeFee,
      application_fee_amount: amounts.applicationFee,
      commission_rate: amounts.commissionRatePct,
      commission_amount: amounts.platformNet,
      connect_account_id: connect.stripe_account_id,
      total_price: amounts.customerCharge,
    }).eq("id", bookingId);

    return new Response(JSON.stringify({ url: session.url, amounts }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-create-booking-checkout error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
