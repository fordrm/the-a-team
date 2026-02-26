
-- Create focused_periods table
CREATE TABLE public.focused_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  initiated_by uuid NOT NULL,
  reason_category text NOT NULL,
  reason_text text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  declined boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  ended_early_by uuid,
  ended_early_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.focused_periods ENABLE ROW LEVEL SECURITY;

-- Validation trigger instead of CHECK constraints
CREATE OR REPLACE FUNCTION public.validate_focused_period()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.trigger_type NOT IN ('person_initiated', 'team_proposed', 'emergency_override') THEN
    RAISE EXCEPTION 'Invalid trigger_type: %', NEW.trigger_type;
  END IF;
  IF NEW.reason_category NOT IN ('feeling_off', 'sleep_changes', 'mood_shift', 'medication_concern', 'team_observation', 'routine_disruption', 'other') THEN
    RAISE EXCEPTION 'Invalid reason_category: %', NEW.reason_category;
  END IF;
  IF NEW.status NOT IN ('pending_ack', 'active', 'expired', 'ended_early', 'declined') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'ends_at must be after starts_at';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_focused_period_trigger
  BEFORE INSERT OR UPDATE ON public.focused_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_focused_period();

-- RLS Policies

-- All group members AND the supported person can view focused periods
CREATE POLICY "Group members and person can view focused periods"
  ON public.focused_periods FOR SELECT
  USING (
    is_group_member(auth.uid(), group_id)
    OR EXISTS (
      SELECT 1 FROM public.persons
      WHERE persons.group_id = focused_periods.group_id
        AND persons.user_id = auth.uid()
    )
  );

-- Person can initiate (person_initiated type only)
CREATE POLICY "Person can initiate focused period"
  ON public.focused_periods FOR INSERT
  WITH CHECK (
    trigger_type = 'person_initiated'
    AND initiated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.persons
      WHERE persons.group_id = focused_periods.group_id
        AND persons.user_id = auth.uid()
    )
  );

-- Coordinators can propose (team_proposed type)
CREATE POLICY "Coordinators can propose focused period"
  ON public.focused_periods FOR INSERT
  WITH CHECK (
    trigger_type = 'team_proposed'
    AND initiated_by = auth.uid()
    AND is_group_coordinator(auth.uid(), group_id)
  );

-- Person can acknowledge/decline team-proposed periods
CREATE POLICY "Person can acknowledge or decline"
  ON public.focused_periods FOR UPDATE
  USING (
    trigger_type = 'team_proposed'
    AND status = 'pending_ack'
    AND EXISTS (
      SELECT 1 FROM public.persons
      WHERE persons.group_id = focused_periods.group_id
        AND persons.user_id = auth.uid()
    )
  );

-- Coordinators can manage focused periods (end early, add review notes)
CREATE POLICY "Coordinators can manage focused periods"
  ON public.focused_periods FOR UPDATE
  USING (is_group_coordinator(auth.uid(), group_id));

-- Person can end their own person_initiated periods early
CREATE POLICY "Person can end own focused period"
  ON public.focused_periods FOR UPDATE
  USING (
    trigger_type = 'person_initiated'
    AND initiated_by = auth.uid()
    AND status = 'active'
  );

-- Index for active period lookups
CREATE INDEX idx_focused_periods_active
  ON public.focused_periods (group_id, status)
  WHERE status IN ('active', 'pending_ack');
