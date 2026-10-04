CREATE TABLE public.ride_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL CHECK (price > 0 AND price < 100000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','selected','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, driver_id)
);
GRANT SELECT ON public.ride_offers TO authenticated; GRANT ALL ON public.ride_offers TO service_role;
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_ride_passenger(_ride uuid, _user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rides WHERE id=_ride AND passenger_id=_user) $$;
CREATE OR REPLACE FUNCTION public.offered_to(_passenger uuid, _driver uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ride_offers o JOIN public.rides r ON r.id=o.ride_id WHERE r.passenger_id=_passenger AND o.driver_id=_driver) $$;
REVOKE EXECUTE ON FUNCTION public.is_ride_passenger(uuid,uuid), public.offered_to(uuid,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_ride_passenger(uuid,uuid), public.offered_to(uuid,uuid) TO authenticated;

CREATE POLICY "offer read" ON public.ride_offers FOR SELECT TO authenticated USING (
  driver_id = auth.uid() OR public.is_ride_passenger(ride_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- passengers may see profiles + ratings context of drivers who offered
DROP POLICY "profile read" ON public.profiles;
CREATE POLICY "profile read" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.shares_ride(auth.uid(), id) OR public.offered_to(auth.uid(), id));
DROP POLICY "driver profile read" ON public.driver_profiles;
CREATE POLICY "driver profile read" ON public.driver_profiles FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.shares_ride(auth.uid(), user_id) OR public.offered_to(auth.uid(), user_id));

-- drivers see open rides (requested or with offers)
DROP POLICY "ride read" ON public.rides;
CREATE POLICY "ride read" ON public.rides FOR SELECT TO authenticated USING (
  passenger_id = auth.uid() OR driver_id = auth.uid() OR public.has_role(auth.uid(),'admin')
  OR (status IN ('waiting','offered') AND public.has_role(auth.uid(),'driver')));

CREATE OR REPLACE FUNCTION public.make_offer(_ride uuid, _price numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'driver') THEN RAISE EXCEPTION 'Not a driver'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND suspended) THEN RAISE EXCEPTION 'Account suspended'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.driver_profiles WHERE user_id=auth.uid() AND is_online) THEN RAISE EXCEPTION 'Go online to make offers'; END IF;
  IF EXISTS (SELECT 1 FROM public.rides WHERE driver_id=auth.uid() AND status IN ('accepted','arriving','arrived','started')) THEN RAISE EXCEPTION 'Finish your current ride first'; END IF;
  IF _price IS NULL OR _price <= 0 OR _price >= 100000 THEN RAISE EXCEPTION 'Invalid price'; END IF;
  PERFORM 1 FROM public.rides WHERE id=_ride AND status IN ('waiting','offered') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride is no longer available'; END IF;
  INSERT INTO public.ride_offers(ride_id, driver_id, price) VALUES (_ride, auth.uid(), _price)
    ON CONFLICT (ride_id, driver_id) DO UPDATE SET price = EXCLUDED.price, status='pending', created_at=now();
  UPDATE public.rides SET status='offered' WHERE id=_ride AND status='waiting';
END $$;

CREATE OR REPLACE FUNCTION public.select_offer(_offer uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.ride_offers;
BEGIN
  SELECT * INTO o FROM public.ride_offers WHERE id=_offer AND status='pending';
  IF o.id IS NULL THEN RAISE EXCEPTION 'Offer not available'; END IF;
  IF NOT public.is_ride_passenger(o.ride_id, auth.uid()) THEN RAISE EXCEPTION 'Not your ride'; END IF;
  IF EXISTS (SELECT 1 FROM public.rides WHERE driver_id=o.driver_id AND status IN ('accepted','arriving','arrived','started')) THEN RAISE EXCEPTION 'This driver just took another ride'; END IF;
  UPDATE public.rides SET driver_id=o.driver_id, price=o.price, status='accepted', accepted_at=now() WHERE id=o.ride_id AND status IN ('waiting','offered');
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride is no longer open'; END IF;
  UPDATE public.ride_offers SET status = CASE WHEN id=_offer THEN 'selected' ELSE 'declined' END WHERE ride_id=o.ride_id;
END $$;

-- cancel must also allow the offered stage
CREATE OR REPLACE FUNCTION public.cancel_ride(_ride uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id=_ride FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Ride not found'; END IF;
  IF public.has_role(auth.uid(),'admin') THEN
    IF r.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Ride already finished'; END IF;
  ELSIF r.passenger_id = auth.uid() THEN
    IF r.status NOT IN ('waiting','offered','accepted','arriving','arrived') THEN RAISE EXCEPTION 'Ride cannot be cancelled now'; END IF;
  ELSIF r.driver_id = auth.uid() THEN
    IF r.status NOT IN ('accepted','arriving','arrived') THEN RAISE EXCEPTION 'Ride cannot be cancelled now'; END IF;
  ELSE RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.rides SET status='cancelled', cancelled_by=auth.uid() WHERE id=_ride;
  UPDATE public.ride_offers SET status='declined' WHERE ride_id=_ride AND status='pending';
END $$;

-- notifications: skip 'offered' status change, notify on new offer
CREATE OR REPLACE FUNCTION public.notify_offer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' OR (NEW.price IS DISTINCT FROM OLD.price) THEN
    INSERT INTO public.notifications(user_id, message, ride_id)
      SELECT r.passenger_id, 'New driver offer: ' || NEW.price || ' EGP', r.id FROM public.rides r WHERE r.id=NEW.ride_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_offer() FROM anon, authenticated, public;
CREATE TRIGGER offers_notify AFTER INSERT OR UPDATE ON public.ride_offers FOR EACH ROW EXECUTE FUNCTION public.notify_offer();

REVOKE EXECUTE ON FUNCTION public.make_offer(uuid,numeric), public.select_offer(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.make_offer(uuid,numeric), public.select_offer(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_offers;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.driver_profiles REPLICA IDENTITY FULL;