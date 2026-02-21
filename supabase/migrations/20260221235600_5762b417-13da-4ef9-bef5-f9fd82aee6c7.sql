
DROP POLICY "Members can insert contact_notes" ON public.contact_notes;

CREATE POLICY "Members can insert contact_notes"
  ON public.contact_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = contact_notes.subject_person_id
        AND p.group_id = contact_notes.group_id
    )
  );
