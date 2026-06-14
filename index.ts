import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYPAL_API_URL = Deno.env.get('PAYPAL_MODE') === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get PayPal access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createOrder(accessToken: string, amount: number, currency: string, description: string, returnUrl?: string, cancelUrl?: string) {
  const orderBody: any = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: currency,
        value: amount.toFixed(2),
      },
      description,
    }],
  };

  if (returnUrl) {
    orderBody.application_context = {
      return_url: returnUrl,
      cancel_url: cancelUrl || returnUrl,
      user_action: 'PAY_NOW',
    };
  }

  const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PayPal order: ${error}`);
  }

  return await response.json();
}

async function captureOrder(accessToken: string, orderId: string) {
  const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to capture PayPal order: ${error}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, booking_id, currency = 'USD', description, order_id, return_url, cancel_url, payment_type } = await req.json();

    // Require authentication for all actions
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Resolve caller's profile id
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('user_id', userData.user.id)
      .single();
    if (!callerProfile) {
      return new Response(JSON.stringify({ success: false, error: 'Profile not found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper: load and authorize booking; return server-trusted amount
    async function loadAuthorizedBooking(bid: string) {
      const { data: booking, error } = await adminClient
        .from('bookings')
        .select('id, customer_id, booking_fee, service_price, total_price')
        .eq('id', bid)
        .single();
      if (error || !booking) return { error: 'Booking not found', status: 404 } as const;
      if (booking.customer_id !== callerProfile.id) {
        return { error: 'Forbidden', status: 403 } as const;
      }
      return { booking } as const;
    }

    const accessToken = await getPayPalAccessToken();

    if (action === 'create-order') {
      if (!booking_id || !description) {
        throw new Error('booking_id and description are required');
      }
      const result = await loadAuthorizedBooking(booking_id);
      if ('error' in result) {
        return new Response(JSON.stringify({ success: false, error: result.error }), {
          status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const b = result.booking;
      const amount = payment_type === 'service_payment'
        ? Number(b.service_price ?? b.total_price ?? 0)
        : Number(b.booking_fee ?? 0);
      if (!amount || amount <= 0) {
        throw new Error('Invalid booking amount');
      }

      const order = await createOrder(accessToken, amount, currency, description, return_url, cancel_url);
      
      return new Response(JSON.stringify({
        success: true,
        order_id: order.id,
        approval_url: order.links.find((link: any) => link.rel === 'approve')?.href,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'capture-order') {
      if (!order_id) {
        throw new Error('Order ID is required');
      }
      // If booking_id provided, verify caller owns the booking BEFORE capturing
      if (booking_id) {
        const result = await loadAuthorizedBooking(booking_id);
        if ('error' in result) {
          return new Response(JSON.stringify({ success: false, error: result.error }), {
            status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const capture = await captureOrder(accessToken, order_id);
      
      // If booking_id provided, update the booking based on payment_type
      if (booking_id && capture.status === 'COMPLETED') {
        const supabase = adminClient;

        if (payment_type === 'booking_fee') {
          await supabase
            .from('bookings')
            .update({ 
              booking_fee_status: 'paid',
              status: 'confirmed',
              notes: `Booking Fee PayPal Payment ID: ${capture.id}`
            })
            .eq('id', booking_id)
            .eq('customer_id', callerProfile.id);
        } else if (payment_type === 'service_payment') {
          await supabase
            .from('bookings')
            .update({ 
              service_payment_status: 'paid',
              notes: `Service Payment PayPal ID: ${capture.id}`
            })
            .eq('id', booking_id)
            .eq('customer_id', callerProfile.id);
        } else {
          // Legacy: update status to confirmed
          await supabase
            .from('bookings')
            .update({ 
              status: 'confirmed',
              notes: `PayPal Payment ID: ${capture.id}`
            })
            .eq('id', booking_id)
            .eq('customer_id', callerProfile.id);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        capture_id: capture.id,
        status: capture.status,
        payer: capture.payer,
        payment_type,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action. Use "create-order" or "capture-order"');

  } catch (error) {
    console.error('PayPal checkout error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
