-- Allow supported person to SELECT agreements where they are the subject
CREATE POLICY "Subject person can select their agreements"
  ON public.agreements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = agreements.subject_person_id
        AND p.group_id = agreements.group_id
        AND p.user_id = auth.uid()
    )
  );

-- Allow supported person to SELECT agreement_versions for their agreements
CREATE POLICY "Subject person can select their agreement versions"
  ON public.agreement_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agreements a
      JOIN public.persons p ON p.id = a.subject_person_id AND p.group_id = a.group_id
      WHERE a.id = agreement_versions.agreement_id
        AND p.user_id = auth.uid()
    )
  );

-- Allow supported person to SELECT their group (needed for portal)
CREATE POLICY "Subject person can select their group"
  ON public.groups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.group_id = groups.id
        AND p.user_id = auth.uid()
    )
  );

-- Allow supported person to SELECT their own persons row
CREATE POLICY "Subject person can select their own person record"
  ON public.persons FOR SELECT TO authenticated
  USING (user_id = auth.uid());