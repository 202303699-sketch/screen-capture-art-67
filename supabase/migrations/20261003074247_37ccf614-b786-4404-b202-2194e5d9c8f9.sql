CREATE TYPE public.app_role AS ENUM ('passenger','driver','admin');
CREATE TYPE public.ride_status AS ENUM ('waiting','accepted','arriving','arrived','started','completed','cancelled');

CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE POLICY "own roles or admin" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, full_name text NOT NULL DEFAULT '', phone text, suspended boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, UPDATE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.driver_profiles (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, car_model text NOT NULL DEFAULT '', plate text NOT NULL DEFAULT '', is_online boolean NOT NULL DEFAULT false, lat double precision, lng double precision, location_updated_at timestamptz);
GRANT SELECT, UPDATE ON public.driver_profiles TO authenticated; GRANT ALL ON public.driver_profiles TO service_role;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL DEFAULT ('AS-' || upper(substr(md5(random()::text),1,6))),
  passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pickup text NOT NULL CHECK (char_length(pickup) BETWEEN 2 AND 200),
  destination text NOT NULL CHECK (char_length(destination) BETWEEN 2 AND 200),
  pickup_lat double precision, pickup_lng double precision,
  dest_lat double precision, dest_lng double precision,
  price numeric(10,2) NOT NULL CHECK (price > 0 AND price < 100000),
  distance_km numeric(8,2), duration_min integer,
  status ride_status NOT NULL DEFAULT 'waiting',
  cancelled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz, started_at timestamptz, completed_at timestamptz
);
GRANT SELECT, INSERT ON public.rides TO authenticated; GRANT ALL ON public.rides TO service_role;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE INDEX rides_status_idx ON public.rides(status);
CREATE INDEX rides_passenger_idx ON public.rides(passenger_id);
CREATE INDEX rides_driver_idx ON public.rides(driver_id);

CREATE TABLE public.ride_rejections (ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE, driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (ride_id, driver_id));
GRANT SELECT, INSERT ON public.ride_rejections TO authenticated; GRANT ALL ON public.ride_rejections TO service_role;
ALTER TABLE public.ride_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rejections" ON public.ride_rejections FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "driver rejects" ON public.ride_rejections FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid() AND public.has_role(auth.uid(),'driver'));

CREATE TABLE public.ratings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE, rater_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, ratee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, stars int NOT NULL CHECK (stars BETWEEN 1 AND 5), comment text CHECK (char_length(comment) <= 500), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(ride_id, rater_id));
GRANT SELECT ON public.ratings TO authenticated; GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings readable" ON public.ratings FOR SELECT TO authenticated USING (true);

CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, message text NOT NULL, ride_id uuid REFERENCES public.rides(id) ON DELETE CASCADE, read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated; GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- relationship helper
CREATE OR REPLACE FUNCTION public.shares_ride(_a uuid, _b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rides WHERE (passenger_id=_a AND driver_id=_b) OR (passenger_id=_b AND driver_id=_a)) $$;

-- profiles policies
CREATE POLICY "profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.shares_ride(auth.uid(), id));
CREATE POLICY "profile update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.guard_profile_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.suspended IS DISTINCT FROM OLD.suspended AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only admins can change suspension';
  END IF;
  IF char_length(NEW.full_name) > 100 OR char_length(coalesce(NEW.phone,'')) > 30 THEN RAISE EXCEPTION 'Invalid profile'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- driver profile policies
CREATE POLICY "driver profile read" ON public.driver_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.shares_ride(auth.uid(), user_id));
CREATE POLICY "driver profile update own" ON public.driver_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- rides policies
CREATE POLICY "ride read" ON public.rides FOR SELECT TO authenticated USING (
  passenger_id = auth.uid() OR driver_id = auth.uid() OR public.has_role(auth.uid(),'admin')
  OR (status = 'waiting' AND public.has_role(auth.uid(),'driver')));
CREATE POLICY "passenger creates ride" ON public.rides FOR INSERT TO authenticated WITH CHECK (
  passenger_id = auth.uid() AND status = 'waiting' AND driver_id IS NULL AND public.has_role(auth.uid(),'passenger')
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.suspended));

-- new user
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := coalesce(NEW.raw_user_meta_data->>'role','passenger');
BEGIN
  IF r NOT IN ('passenger','driver') THEN r := 'passenger'; END IF;
  INSERT INTO public.profiles(id, full_name, phone) VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'full_name', ''),100), left(NEW.raw_user_meta_data->>'phone',30));
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, r::app_role);
  IF r = 'driver' THEN
    INSERT INTO public.driver_profiles(user_id, car_model, plate) VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'car_model',''),60), left(coalesce(NEW.raw_user_meta_data->>'plate',''),20));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ride actions
CREATE OR REPLACE FUNCTION public.accept_ride(_ride uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'driver') THEN RAISE EXCEPTION 'Not a driver'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND suspended) THEN RAISE EXCEPTION 'Account suspended'; END IF;
  IF EXISTS (SELECT 1 FROM public.rides WHERE driver_id=auth.uid() AND status IN ('accepted','arriving','arrived','started')) THEN RAISE EXCEPTION 'Finish your current ride first'; END IF;
  UPDATE public.rides SET driver_id=auth.uid(), status='accepted', accepted_at=now() WHERE id=_ride AND status='waiting';
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride is no longer available'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.advance_ride(_ride uuid) RETURNS ride_status LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur ride_status; nxt ride_status;
BEGIN
  SELECT status INTO cur FROM public.rides WHERE id=_ride AND driver_id=auth.uid() FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'Not your ride'; END IF;
  nxt := CASE cur WHEN 'accepted' THEN 'arriving' WHEN 'arriving' THEN 'arrived' WHEN 'arrived' THEN 'started' WHEN 'started' THEN 'completed' ELSE NULL END;
  IF nxt IS NULL THEN RAISE EXCEPTION 'Ride cannot advance'; END IF;
  UPDATE public.rides SET status=nxt,
    started_at = CASE WHEN nxt='started' THEN now() ELSE started_at END,
    completed_at = CASE WHEN nxt='completed' THEN now() ELSE completed_at END
  WHERE id=_ride;
  RETURN nxt;
END $$;

CREATE OR REPLACE FUNCTION public.complete_ride_passenger(_ride uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.rides SET status='completed', completed_at=now() WHERE id=_ride AND passenger_id=auth.uid() AND status='started';
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride can only be completed after the trip starts'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_ride(_ride uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id=_ride FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Ride not found'; END IF;
  IF public.has_role(auth.uid(),'admin') THEN
    IF r.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Ride already finished'; END IF;
  ELSIF r.passenger_id = auth.uid() THEN
    IF r.status NOT IN ('waiting','accepted','arriving','arrived') THEN RAISE EXCEPTION 'Ride cannot be cancelled now'; END IF;
  ELSIF r.driver_id = auth.uid() THEN
    IF r.status NOT IN ('accepted','arriving','arrived') THEN RAISE EXCEPTION 'Ride cannot be cancelled now'; END IF;
  ELSE RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.rides SET status='cancelled', cancelled_by=auth.uid() WHERE id=_ride;
END $$;

CREATE OR REPLACE FUNCTION public.rate_ride(_ride uuid, _stars int, _comment text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides; target uuid;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id=_ride;
  IF r.status <> 'completed' THEN RAISE EXCEPTION 'Only completed rides can be rated'; END IF;
  IF r.passenger_id = auth.uid() THEN target := r.driver_id;
  ELSIF r.driver_id = auth.uid() THEN target := r.passenger_id;
  ELSE RAISE EXCEPTION 'Not allowed'; END IF;
  IF _stars < 1 OR _stars > 5 THEN RAISE EXCEPTION 'Stars must be 1-5'; END IF;
  INSERT INTO public.ratings(ride_id, rater_id, ratee_id, stars, comment) VALUES (_ride, auth.uid(), target, _stars, nullif(left(trim(coalesce(_comment,'')),500),''));
END $$;

REVOKE EXECUTE ON FUNCTION public.accept_ride, public.advance_ride, public.complete_ride_passenger, public.cancel_ride, public.rate_ride FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_ride, public.advance_ride, public.complete_ride_passenger, public.cancel_ride, public.rate_ride TO authenticated;

-- notifications
CREATE OR REPLACE FUNCTION public.notify_ride() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE msg text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, message, ride_id)
      SELECT d.user_id, 'New ride request: ' || NEW.pickup || ' → ' || NEW.destination, NEW.id FROM public.driver_profiles d WHERE d.is_online;
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  msg := CASE NEW.status WHEN 'accepted' THEN 'Your ride was accepted' WHEN 'arriving' THEN 'Driver is arriving'
    WHEN 'arrived' THEN 'Driver has arrived' WHEN 'started' THEN 'Trip started' WHEN 'completed' THEN 'Trip completed' WHEN 'cancelled' THEN 'Ride cancelled' END;
  IF msg IS NULL THEN RETURN NEW; END IF;
  IF NEW.passenger_id IS DISTINCT FROM auth.uid() THEN INSERT INTO public.notifications(user_id, message, ride_id) VALUES (NEW.passenger_id, msg, NEW.id); END IF;
  IF NEW.driver_id IS NOT NULL AND NEW.driver_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications(user_id, message, ride_id) VALUES (NEW.driver_id, CASE WHEN NEW.status='cancelled' THEN 'Ride cancelled' WHEN NEW.status='completed' THEN 'Trip completed' ELSE 'Ride ' || NEW.status::text END, NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rides_notify AFTER INSERT OR UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.notify_ride();

ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_profiles;