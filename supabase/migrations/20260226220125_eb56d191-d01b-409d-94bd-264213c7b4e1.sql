
-- Add new columns to contact_notes for self-report support
ALTER TABLE contact_notes
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'supporter_observation',
  ADD COLUMN IF NOT EXISTS shared_from_id uuid REFERENCES contact_notes(id),
  ADD COLUMN IF NOT EXISTS reason_category text,
  ADD COLUMN IF NOT EXISTS reason_text text;

-- Validation trigger instead of CHECK constraints
CREATE OR REPLACE FUNCTION public.validate_contact_note_source()
RETURNS trigger
LANGUAGE plpgsql
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

CREATE TRIGGER validate_contact_note_source_trigger
  BEFORE INSERT OR UPDATE ON contact_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_contact_note_source();

-- Backfill existing notes
UPDATE contact_notes SET source = 'supporter_observation' WHERE source IS NULL;

-- RLS: Allow subject person to insert self-report notes
CREATE POLICY "Subject person can insert self-report notes"
  ON contact_notes FOR INSERT
  WITH CHECK (
    (source IN ('self_report', 'shared_snapshot'))
    AND (author_user_id = auth.uid())
    AND (EXISTS (
      SELECT 1 FROM persons p
      WHERE p.id = contact_notes.subject_person_id
        AND p.group_id = contact_notes.group_id
        AND p.user_id = auth.uid()
    ))
  );

-- RLS: Subject person can select their own private notes
CREATE POLICY "Subject person can select own private notes"
  ON contact_notes FOR SELECT
  USING (
    (visibility_tier = 'private_to_person')
    AND (author_user_id = auth.uid())
    AND (EXISTS (
      SELECT 1 FROM persons p
      WHERE p.id = contact_notes.subject_person_id
        AND p.group_id = contact_notes.group_id
        AND p.user_id = auth.uid()
    ))
  );

-- RLS: Coordinators can also see private_to_person notes
CREATE POLICY "Coordinators can select private_to_person notes"
  ON contact_notes FOR SELECT
  USING (
    (visibility_tier = 'private_to_person')
    AND is_group_coordinator(auth.uid(), group_id)
  );
