
DROP POLICY "Members can update interventions" ON public.interventions;

CREATE POLICY "Members can update interventions"
  ON public.interventions
  FOR UPDATE TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND (
      public.is_group_coordinator(auth.uid(), group_id)
      OR (
        created_by_user_id = auth.uid()
        AND created_at > (now() - interval '15 minutes')
      )
    )
  )
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND (
      public.is_group_coordinator(auth.uid(), group_id)
      OR (
        created_by_user_id = auth.uid()
        AND created_at > (now() - interval '15 minutes')
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = interventions.subject_person_id
        AND p.group_id = interventions.group_id
    )
  );
