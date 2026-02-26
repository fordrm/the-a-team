
-- Create get_team_note_summary function that returns total and category breakdown
CREATE OR REPLACE FUNCTION public.get_team_note_summary(p_group_id uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'total', COALESCE(SUM(cat_count), 0),
      'by_category', COALESCE(
        jsonb_object_agg(category, cat_count),
        '{}'::jsonb
      )
    )
    FROM (
      SELECT
        COALESCE(reason_category, 'uncategorized') AS category,
        COUNT(*)::integer AS cat_count
      FROM public.contact_notes
      WHERE group_id = p_group_id
        AND source = 'supporter_observation'
        AND created_at > now() - (p_days || ' days')::interval
      GROUP BY COALESCE(reason_category, 'uncategorized')
    ) sub
  );
END;
$$;
