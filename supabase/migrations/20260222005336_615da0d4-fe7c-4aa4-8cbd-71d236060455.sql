
-- Tighten INSERT policy
DROP POLICY "Members can insert contradictions" ON public.contradictions;

CREATE POLICY "Members can insert contradictions"
  ON public.contradictions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = contradictions.subject_person_id
        AND p.group_id = contradictions.group_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM unnest(contradictions.related_note_ids) AS rid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.contact_notes n
        WHERE n.id = rid
          AND n.group_id = contradictions.group_id
          AND n.subject_person_id = contradictions.subject_person_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM unnest(contradictions.related_agreement_ids) AS rid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.agreements a
        WHERE a.id = rid
          AND a.group_id = contradictions.group_id
          AND a.subject_person_id = contradictions.subject_person_id
      )
    )
  );

-- Tighten UPDATE policy
DROP POLICY "Coordinators can update contradictions" ON public.contradictions;

CREATE POLICY "Coordinators can update contradictions"
  ON public.contradictions
  FOR UPDATE
  TO authenticated
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
        AND status NOT IN ('resolved', 'dismissed')
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM unnest(contradictions.related_note_ids) AS rid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.contact_notes n
        WHERE n.id = rid
          AND n.group_id = contradictions.group_id
          AND n.subject_person_id = contradictions.subject_person_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM unnest(contradictions.related_agreement_ids) AS rid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.agreements a
        WHERE a.id = rid
          AND a.group_id = contradictions.group_id
          AND a.subject_person_id = contradictions.subject_person_id
      )
    )
  );
