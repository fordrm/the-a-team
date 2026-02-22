-- Allow supported person to SELECT shared_with_person notes about them
CREATE POLICY "Subject person can select shared notes"
  ON public.contact_notes FOR SELECT TO authenticated
  USING (
    visibility_tier = 'shared_with_person'
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = contact_notes.subject_person_id
        AND p.group_id = contact_notes.group_id
        AND p.user_id = auth.uid()
    )
  );