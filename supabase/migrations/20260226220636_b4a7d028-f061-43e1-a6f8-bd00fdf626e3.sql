
-- Create group_settings table
CREATE TABLE group_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  operating_mode text NOT NULL DEFAULT 'collaborative',
  default_note_visibility text NOT NULL DEFAULT 'supporters_only',
  indicator_input_mode text NOT NULL DEFAULT 'self_report_primary',
  plan_authorship text NOT NULL DEFAULT 'mutual',
  sharing_model text NOT NULL DEFAULT 'person_pushes',
  focused_period_ack text NOT NULL DEFAULT 'active_consent',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(group_id)
);

-- Validation trigger instead of CHECK constraints
CREATE OR REPLACE FUNCTION public.validate_group_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.operating_mode NOT IN ('collaborative', 'coordinated', 'crisis') THEN
    RAISE EXCEPTION 'Invalid operating_mode: %', NEW.operating_mode;
  END IF;
  IF NEW.default_note_visibility NOT IN ('shared_with_person', 'supporters_only', 'restricted', 'private_to_person') THEN
    RAISE EXCEPTION 'Invalid default_note_visibility: %', NEW.default_note_visibility;
  END IF;
  IF NEW.indicator_input_mode NOT IN ('self_report_primary', 'observer_primary', 'dual') THEN
    RAISE EXCEPTION 'Invalid indicator_input_mode: %', NEW.indicator_input_mode;
  END IF;
  IF NEW.plan_authorship NOT IN ('mutual', 'team_proposes', 'person_proposes') THEN
    RAISE EXCEPTION 'Invalid plan_authorship: %', NEW.plan_authorship;
  END IF;
  IF NEW.sharing_model NOT IN ('person_pushes', 'team_realtime', 'hybrid') THEN
    RAISE EXCEPTION 'Invalid sharing_model: %', NEW.sharing_model;
  END IF;
  IF NEW.focused_period_ack NOT IN ('active_consent', 'notification', 'auto') THEN
    RAISE EXCEPTION 'Invalid focused_period_ack: %', NEW.focused_period_ack;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_group_settings_trigger
  BEFORE INSERT OR UPDATE ON group_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_group_settings();

-- Enable RLS
ALTER TABLE group_settings ENABLE ROW LEVEL SECURITY;

-- Group members and supported persons can read settings
CREATE POLICY "Group members can view settings"
  ON group_settings FOR SELECT
  USING (
    is_group_member(auth.uid(), group_id)
    OR EXISTS (
      SELECT 1 FROM persons
      WHERE persons.group_id = group_settings.group_id
        AND persons.user_id = auth.uid()
    )
  );

CREATE POLICY "Coordinators can update settings"
  ON group_settings FOR UPDATE
  USING (is_group_coordinator(auth.uid(), group_id))
  WITH CHECK (is_group_coordinator(auth.uid(), group_id));

CREATE POLICY "Coordinators can create settings"
  ON group_settings FOR INSERT
  WITH CHECK (is_group_coordinator(auth.uid(), group_id));

-- Backfill existing groups
INSERT INTO group_settings (group_id, updated_by)
SELECT id, created_by_user_id
FROM groups
WHERE id NOT IN (SELECT group_id FROM group_settings);

-- Helper function
CREATE OR REPLACE FUNCTION public.get_group_operating_mode(p_group_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mode text;
BEGIN
  SELECT operating_mode INTO v_mode
  FROM public.group_settings
  WHERE group_id = p_group_id;
  RETURN COALESCE(v_mode, 'collaborative');
END;
$$;
