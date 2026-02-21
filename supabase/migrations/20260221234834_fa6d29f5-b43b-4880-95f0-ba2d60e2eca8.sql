
-- Drop existing insufficient INSERT policy
DROP POLICY "Person can insert acceptance" ON public.agreement_acceptances;

-- Create tightened INSERT policy
CREATE POLICY "Person can insert acceptance"
  ON public.agreement_acceptances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- A) active group member
    public.is_group_member(auth.uid(), group_id)
    -- B) row attributed to current user
    AND person_user_id = auth.uid()
    -- C) current user is a supported person in this group
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.group_id = agreement_acceptances.group_id
        AND p.user_id = auth.uid()
    )
    -- D) referenced version belongs to same group
    AND EXISTS (
      SELECT 1 FROM public.agreement_versions av
      WHERE av.id = agreement_acceptances.agreement_version_id
        AND av.group_id = agreement_acceptances.group_id
    )
    -- E) referenced agreement belongs to same group and is for this person
    AND EXISTS (
      SELECT 1 FROM public.agreements a
      JOIN public.persons p ON p.id = a.subject_person_id
      WHERE a.id = agreement_acceptances.agreement_id
        AND a.group_id = agreement_acceptances.group_id
        AND p.group_id = agreement_acceptances.group_id
        AND p.user_id = auth.uid()
    )
  );
