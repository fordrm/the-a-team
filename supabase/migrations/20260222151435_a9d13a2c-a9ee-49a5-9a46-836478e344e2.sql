
-- 1. Add closure column to agreements table
ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS closure jsonb DEFAULT NULL;

-- 2. Add renewed_as column to link original → renewed agreement
ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS renewed_as uuid REFERENCES agreements(id) DEFAULT NULL;

-- 3. Create helper function to check if review is needed (duration expired)
CREATE OR REPLACE FUNCTION check_agreement_reviews()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE agreements
  SET status = 'review_needed'
  WHERE status = 'accepted'
    AND closure IS NULL
    AND current_version_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM agreement_versions av
      WHERE av.id = agreements.current_version_id
        AND (av.fields->'duration'->>'type') = 'fixed'
        AND (av.fields->'duration'->>'end_date') IS NOT NULL
        AND (av.fields->'duration'->>'end_date')::date < CURRENT_DATE
    );
END;
$$;
