
-- Role type for profiles
CREATE TYPE public.user_role AS ENUM ('customer', 'service_provider');

-- App role for admin access
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Service status
CREATE TYPE public.service_status AS ENUM ('available', 'unavailable');

-- Booking status
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'customer',
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (for admin/moderator access)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'General',
  status service_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  provider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Provider milestones tracking (completed bookings count for commission reduction)
CREATE TABLE public.provider_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  completed_bookings INTEGER NOT NULL DEFAULT 0,
  current_commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_milestones ENABLE ROW LEVEL SECURITY;

-- Helper functions (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view active provider profiles" ON public.profiles FOR SELECT USING (role = 'service_provider' AND is_active = true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Services policies
CREATE POLICY "Anyone authenticated can view available services" ON public.services FOR SELECT TO authenticated USING (status = 'available');
CREATE POLICY "Providers can view own services" ON public.services FOR SELECT TO authenticated USING (provider_id = public.get_profile_id(auth.uid()));
CREATE POLICY "Providers can create services" ON public.services FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) = 'service_provider' AND provider_id = public.get_profile_id(auth.uid()));
CREATE POLICY "Providers can update own services" ON public.services FOR UPDATE TO authenticated USING (provider_id = public.get_profile_id(auth.uid()));
CREATE POLICY "Providers can delete own services" ON public.services FOR DELETE TO authenticated USING (provider_id = public.get_profile_id(auth.uid()));

-- Bookings policies
CREATE POLICY "Customers can view own bookings" ON public.bookings FOR SELECT TO authenticated USING (customer_id = public.get_profile_id(auth.uid()));
CREATE POLICY "Providers can view bookings for their services" ON public.bookings FOR SELECT TO authenticated USING (provider_id = public.get_profile_id(auth.uid()));
CREATE POLICY "Customers can create bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) = 'customer' AND customer_id = public.get_profile_id(auth.uid()));
CREATE POLICY "Providers can update booking status" ON public.bookings FOR UPDATE TO authenticated USING (provider_id = public.get_profile_id(auth.uid()));
CREATE POLICY "Customers can cancel own bookings" ON public.bookings FOR UPDATE TO authenticated USING (customer_id = public.get_profile_id(auth.uid()));

-- Provider milestones policies
CREATE POLICY "Providers can view own milestones" ON public.provider_milestones FOR SELECT TO authenticated USING (provider_id = public.get_profile_id(auth.uid()));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create provider milestone record when a provider profile is created
CREATE OR REPLACE FUNCTION public.handle_new_provider()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'service_provider' THEN
    INSERT INTO public.provider_milestones (provider_id) VALUES (NEW.id)
    ON CONFLICT (provider_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_provider_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_provider();

-- Function to calculate commission on booking completion
CREATE OR REPLACE FUNCTION public.handle_booking_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_rate DECIMAL(5,2);
  new_count INTEGER;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get current commission rate for provider
    SELECT current_commission_rate INTO current_rate
    FROM public.provider_milestones
    WHERE provider_id = NEW.provider_id;

    IF current_rate IS NULL THEN
      current_rate := 10.00;
    END IF;

    -- Set commission on the booking
    NEW.commission_rate := current_rate;
    NEW.commission_amount := NEW.total_price * (current_rate / 100);

    -- Increment completed bookings and possibly reduce commission
    UPDATE public.provider_milestones
    SET completed_bookings = completed_bookings + 1,
        current_commission_rate = GREATEST(1.00, current_commission_rate - 
          CASE WHEN (completed_bookings + 1) % 10 = 0 THEN 1.00 ELSE 0 END),
        updated_at = now()
    WHERE provider_id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_completed
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_booking_completion();
