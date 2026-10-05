ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'ride' CHECK (service_type IN ('ride','delivery')),
  ADD COLUMN IF NOT EXISTS package_description text CHECK (char_length(package_description) <= 300),
  ADD COLUMN IF NOT EXISTS recipient_name text CHECK (char_length(recipient_name) <= 100),
  ADD COLUMN IF NOT EXISTS recipient_phone text CHECK (char_length(recipient_phone) <= 30);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated; GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_ride_party(_ride uuid, _user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rides WHERE id=_ride AND (passenger_id=_user OR driver_id=_user)) $$;
CREATE OR REPLACE FUNCTION public.ride_chat_open(_ride uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rides WHERE id=_ride AND status IN ('accepted','arriving','arrived','started')) $$;
REVOKE EXECUTE ON FUNCTION public.is_ride_party(uuid,uuid), public.ride_chat_open(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_ride_party(uuid,uuid), public.ride_chat_open(uuid) TO authenticated;

CREATE POLICY "chat read" ON public.messages FOR SELECT TO authenticated USING (public.is_ride_party(ride_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "chat send" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_ride_party(ride_id, auth.uid()) AND public.ride_chat_open(ride_id));

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated; GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report create" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid() AND status='open' AND (ride_id IS NULL OR public.is_ride_party(ride_id, auth.uid())));
CREATE POLICY "report read" ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "report admin update" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- admin can manage driver profiles (e.g. force offline)
CREATE POLICY "admin driver update" ON public.driver_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- offers: withdraw + expiry on select
CREATE OR REPLACE FUNCTION public.withdraw_offer(_ride uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ride_offers SET status='declined' WHERE ride_id=_ride AND driver_id=auth.uid() AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending offer'; END IF;
  UPDATE public.rides r SET status='waiting' WHERE r.id=_ride AND r.status='offered'
    AND NOT EXISTS (SELECT 1 FROM public.ride_offers o WHERE o.ride_id=_ride AND o.status='pending');
END $$;

CREATE OR REPLACE FUNCTION public.select_offer(_offer uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.ride_offers;
BEGIN
  SELECT * INTO o FROM public.ride_offers WHERE id=_offer AND status='pending' FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Offer not available'; END IF;
  IF o.created_at < now() - interval '10 minutes' THEN RAISE EXCEPTION 'This offer has expired'; END IF;
  IF NOT public.is_ride_passenger(o.ride_id, auth.uid()) THEN RAISE EXCEPTION 'Not your ride'; END IF;
  IF EXISTS (SELECT 1 FROM public.rides WHERE driver_id=o.driver_id AND status IN ('accepted','arriving','arrived','started')) THEN RAISE EXCEPTION 'This driver just took another ride'; END IF;
  UPDATE public.rides SET driver_id=o.driver_id, price=o.price, status='accepted', accepted_at=now() WHERE id=o.ride_id AND status IN ('waiting','offered');
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride is no longer open'; END IF;
  UPDATE public.ride_offers SET status = CASE WHEN id=_offer THEN 'selected' ELSE 'declined' END WHERE ride_id=o.ride_id;
  -- driver's other pending offers are withdrawn to prevent conflicting assignments
  UPDATE public.ride_offers SET status='declined' WHERE driver_id=o.driver_id AND status='pending' AND ride_id <> o.ride_id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_no_driver(_ride uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.rides r SET status='no_driver' WHERE r.id=_ride AND r.passenger_id=auth.uid()
    AND r.status IN ('waiting','offered') AND r.created_at < now() - interval '10 minutes'
    AND NOT EXISTS (SELECT 1 FROM public.ride_offers o WHERE o.ride_id=r.id AND o.status='pending' AND o.created_at > now() - interval '10 minutes');
  IF NOT FOUND THEN RAISE EXCEPTION 'Still waiting for offers'; END IF;
  UPDATE public.ride_offers SET status='declined' WHERE ride_id=_ride AND status='pending';
END $$;

REVOKE EXECUTE ON FUNCTION public.withdraw_offer(uuid), public.mark_no_driver(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.withdraw_offer(uuid), public.mark_no_driver(uuid) TO authenticated;

-- notifications for messages and no_driver
CREATE OR REPLACE FUNCTION public.notify_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, message, ride_id)
  SELECT CASE WHEN r.passenger_id = NEW.sender_id THEN r.driver_id ELSE r.passenger_id END, 'New message: ' || left(NEW.body, 60), r.id
  FROM public.rides r WHERE r.id = NEW.ride_id AND r.driver_id IS NOT NULL;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_message() FROM anon, authenticated, public;
CREATE TRIGGER messages_notify AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_message();

CREATE OR REPLACE FUNCTION public.notify_ride() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE msg text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, message, ride_id)
      SELECT d.user_id, CASE WHEN NEW.service_type='delivery' THEN 'New delivery request: ' ELSE 'New ride request: ' END || NEW.pickup || ' → ' || NEW.destination, NEW.id
      FROM public.driver_profiles d WHERE d.is_online AND d.user_id <> NEW.passenger_id;
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  msg := CASE NEW.status WHEN 'accepted' THEN 'Your ride was accepted' WHEN 'arriving' THEN 'Driver is arriving'
    WHEN 'arrived' THEN 'Driver has arrived' WHEN 'started' THEN 'Trip started' WHEN 'completed' THEN 'Trip completed'
    WHEN 'cancelled' THEN 'Ride cancelled' WHEN 'no_driver' THEN 'No driver found' END;
  IF msg IS NULL THEN RETURN NEW; END IF;
  IF NEW.passenger_id IS DISTINCT FROM auth.uid() THEN INSERT INTO public.notifications(user_id, message, ride_id) VALUES (NEW.passenger_id, msg, NEW.id); END IF;
  IF NEW.driver_id IS NOT NULL AND NEW.driver_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications(user_id, message, ride_id) VALUES (NEW.driver_id,
      CASE NEW.status WHEN 'accepted' THEN 'You were selected for a ride' WHEN 'cancelled' THEN 'Ride cancelled' WHEN 'completed' THEN 'Trip completed' ELSE 'Ride ' || NEW.status::text END, NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE INDEX IF NOT EXISTS ride_offers_ride_idx ON public.ride_offers(ride_id);
CREATE INDEX IF NOT EXISTS ride_offers_driver_idx ON public.ride_offers(driver_id, status);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_ride_idx ON public.messages(ride_id, created_at);
CREATE INDEX IF NOT EXISTS ratings_ratee_idx ON public.ratings(ratee_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;