import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface ServiceWithProvider {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  provider_id: string;
  photo_url?: string;
  photo_urls?: string[];
  profiles?: {
    full_name: string;
    avatar_url?: string;
    city?: string;
    state?: string;
    average_rating?: number;
    total_reviews?: number;
    total_services_completed?: number;
    latitude?: number;
    longitude?: number;
  };
  distance_mi?: number;
  recommendation_score?: number;
  recommendation_reason?: string;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateCategorySimilarity(userCategories: string[], serviceCategory: string): number {
  if (userCategories.includes(serviceCategory)) return 1.0;
  const categoryGroups = [
    ['Home Improvement', 'Home Maintenance', 'Specialized Niches'],
    ['Technology & IT', 'AI Automation Services', 'Software Development'],
    ['Health & Wellness', 'Beauty & Grooming', 'Physical Therapy'],
    ['Marketing & Advertising', 'Content Creation', 'Visual Design'],
    ['Corporate & Administrative', 'Financial & Legal', 'Business Consulting']
  ];
  for (const group of categoryGroups) {
    if (group.some(cat => userCategories.some(userCat => userCat.includes(cat))) && 
        group.some(cat => serviceCategory.includes(cat))) {
      return 0.6;
    }
  }
  return 0.1;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT manually
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const user = claimsData.user;

    // Get user's profile
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, latitude, longitude, city, state, zip_code')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { 
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userProfile = profileData;

    // Get booking history
    const { data: bookingsData } = await supabaseClient
      .from('bookings')
      .select('service_id, status, services!inner(category)')
      .eq('customer_id', userProfile.id)
      .eq('status', 'completed');

    const userBookings = bookingsData || [];
    const userCategories = [...new Set(userBookings.map((b: any) => b.services?.category).filter(Boolean))];

    // Get available services
    const { data: services, error: servicesError } = await supabaseClient
      .from('services')
      .select(`
        id, title, description, price, category, provider_id, photo_url, photo_urls,
        profiles!inner(full_name, avatar_url, city, state, average_rating, total_reviews, total_services_completed)
      `)
      .eq('status', 'available')
      .neq('provider_id', userProfile.id)
      .limit(50);

    if (servicesError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch services' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch provider service areas for visible providers
    const providerIds = [...new Set((services || []).map((s: any) => s.provider_id))];
    const { data: areasData } = await supabaseClient
      .from('public_provider_service_areas')
      .select('provider_id, area_type, zip_code, city, state, latitude, longitude, radius_miles, is_active')
      .in('provider_id', providerIds);

    const areasByProvider = new Map<string, any[]>();
    ((areasData as any[]) || []).forEach((a: any) => {
      const list = areasByProvider.get(a.provider_id) || [];
      list.push(a);
      areasByProvider.set(a.provider_id, list);
    });

    const norm = (s: any) => (s ? String(s).trim().toLowerCase() : '');
    const providerServesCustomer = (providerId: string): boolean => {
      const areas = (areasByProvider.get(providerId) || []).filter((a: any) => a.is_active);
      if (areas.length === 0) return true;
      for (const a of areas) {
        if (a.area_type === 'radius' && userProfile.latitude != null && userProfile.longitude != null && a.latitude != null && a.longitude != null && a.radius_miles != null) {
          const d = calculateDistance(userProfile.latitude, userProfile.longitude, a.latitude, a.longitude);
          if (d <= Number(a.radius_miles) + 1) return true;
        } else if (a.area_type === 'zip') {
          if (norm(a.zip_code) && norm(a.zip_code) === norm((userProfile as any).zip_code)) return true;
        } else if (a.area_type === 'region') {
          if (norm(a.city) && norm(a.city) === norm(userProfile.city)) return true;
          if (!norm(a.city) && norm(a.state) && norm(a.state) === norm(userProfile.state)) return true;
        }
      }
      return false;
    };

    // Calculate recommendation scores
    const recommendations: ServiceWithProvider[] = (services || [])
      .filter((service: any) => providerServesCustomer(service.provider_id))
      .map((service: any) => {
        let score = 0;
        let reasons: string[] = [];
        
        const categorySimilarity = calculateCategorySimilarity(userCategories, service.category || '');
        score += categorySimilarity * 0.4;
        if (categorySimilarity === 1.0) reasons.push('Previously booked similar service');
        else if (categorySimilarity > 0.5) reasons.push('Related to your interests');
        
        let distance = 0;
        // Note: provider lat/lng no longer included in join for security
        // Distance scoring disabled to avoid exposing precise GPS
        
        const rating = service.profiles?.average_rating || 0;
        score += (rating / 5) * 0.2;
        if (rating >= 4.5) reasons.push('Highly rated provider');
        else if (rating >= 4.0) reasons.push('Well-rated provider');
        
        const completedServices = service.profiles?.total_services_completed || 0;
        score += Math.min(completedServices / 50, 1) * 0.1;
        if (completedServices >= 20) reasons.push('Experienced provider');
        
        return {
          ...service,
          distance_mi: distance,
          recommendation_score: score,
          recommendation_reason: reasons.join(' • ')
        };
      })
      .filter((s: any) => s.recommendation_score > 0.2)
      .sort((a: any, b: any) => (b.recommendation_score || 0) - (a.recommendation_score || 0))
      .slice(0, 8);

    return new Response(JSON.stringify({
      recommendations,
      user_categories: userCategories,
      total_bookings: userBookings.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Recommendations error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
