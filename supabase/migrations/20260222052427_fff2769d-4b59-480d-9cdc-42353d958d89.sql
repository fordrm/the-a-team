-- Subject person can respond to agreements (insert acceptances)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Subject person can respond to agreements" ON agreement_acceptances;
  CREATE POLICY "Subject person can respond to agreements"
    ON agreement_acceptances FOR INSERT
    WITH CHECK (
      person_user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM agreements a
        JOIN persons p ON p.id = a.subject_person_id
        WHERE a.id = agreement_acceptances.agreement_id
          AND a.group_id = agreement_acceptances.group_id
          AND p.user_id = auth.uid()
      )
    );
END $$;

-- Subject person can propose modifications (insert versions)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Subject person can propose modifications" ON agreement_versions;
  CREATE POLICY "Subject person can propose modifications"
    ON agreement_versions FOR INSERT
    WITH CHECK (
      proposed_by_user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM agreements a
        JOIN persons p ON p.id = a.subject_person_id
        WHERE a.id = agreement_versions.agreement_id
          AND a.group_id = agreement_versions.group_id
          AND p.user_id = auth.uid()
      )
    );
END $$;

-- Subject person can view agreement acceptances
DO $$
BEGIN
  DROP POLICY IF EXISTS "Subject person can view agreement acceptances" ON agreement_acceptances;
  CREATE POLICY "Subject person can view agreement acceptances"
    ON agreement_acceptances FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM agreements a
        JOIN persons p ON p.id = a.subject_person_id
        WHERE a.id = agreement_acceptances.agreement_id
          AND p.user_id = auth.uid()
      )
    );
END $$;