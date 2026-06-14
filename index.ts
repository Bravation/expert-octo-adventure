import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

// Stripe webhooks are server-to-server; no CORS / browser preflight needed.
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook received with invalid or missing env query parameter:", rawEnv);
    return new Response(
      JSON.stringify({ received: true, ignored: "invalid env" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  const env: StripeEnv = rawEnv;

  let event: { type: string; data: { object: any }; id: string };
  try {
    event = await verifyWebhook(req, env);
  } catch (e) {
    console.error("Signature verification failed:", e);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    console.log(`[my-endpoint] received ${event.type} (${event.id}) env=${env}`);
    const obj = event.data.object;

    switch (event.type) {
      case "checkout.session.completed": {
        const bookingId = obj.metadata?.booking_id;
        if (bookingId) {
          await getSupabase().from("bookings").update({
            service_payment_status: "paid",
            booking_fee_status: "paid",
            stripe_payment_intent_id: obj.payment_intent ?? null,
            stripe_checkout_session_id: obj.id,
          }).eq("id", bookingId);
          console.log("Booking marked paid via checkout.session.completed:", bookingId);
        }
        break;
      }
      case "payment_intent.succeeded": {
        const bookingId = obj.metadata?.booking_id;
        if (bookingId) {
          await getSupabase().from("bookings").update({
            service_payment_status: "paid",
            booking_fee_status: "paid",
            stripe_payment_intent_id: obj.id,
          }).eq("id", bookingId);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const bookingId = obj.metadata?.booking_id;
        if (bookingId) {
          await getSupabase().from("bookings").update({
            service_payment_status: "failed",
          }).eq("id", bookingId);
        }
        console.log("PaymentIntent failed:", obj.id, obj.last_payment_error?.message);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        console.log("Subscription event:", event.type, obj.id, "status:", obj.status);
        break;
      case "account.updated": {
        await getSupabase().from("connect_accounts").update({
          charges_enabled: !!obj.charges_enabled,
          payouts_enabled: !!obj.payouts_enabled,
          details_submitted: !!obj.details_submitted,
          requirements: obj.requirements ?? {},
        }).eq("stripe_account_id", obj.id);
        break;
      }
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("my-endpoint handler error:", e);
    // Return 500 so Stripe retries.
    return new Response("Webhook handler error", { status: 500 });
  }
});
