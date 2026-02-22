
DROP POLICY "Members can select contradictions" ON public.contradictions;

CREATE POLICY "Members can select contradictions"
  ON public.contradictions
  FOR SELECT
  TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND (
      public.is_group_coordinator(auth.uid(), group_id)
      OR NOT EXISTS (
        SELECT 1 FROM public.persons p
        WHERE p.id = contradictions.subject_person_id
          AND p.user_id = auth.uid()
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.persons p
          WHERE p.id = contradictions.subject_person_id
            AND p.user_id = auth.uid()
        )
        AND contradictions.type <> 'triangulation'
      )
    )
  );
