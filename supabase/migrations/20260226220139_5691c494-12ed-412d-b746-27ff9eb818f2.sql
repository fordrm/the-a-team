
-- Fix search_path on newly created function
CREATE OR REPLACE FUNCTION public.validate_contact_note_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.source IS NOT NULL AND NEW.source NOT IN ('supporter_observation', 'self_report', 'shared_snapshot') THEN
    RAISE EXCEPTION 'Invalid source value: %', NEW.source;
  END IF;
  IF NEW.reason_category IS NOT NULL AND NEW.reason_category NOT IN ('mood_shift', 'sleep_disruption', 'communication_change', 'safety_concern', 'logistics', 'other') THEN
    RAISE EXCEPTION 'Invalid reason_category value: %', NEW.reason_category;
  END IF;
  RETURN NEW;
END;
$$;
