
CREATE OR REPLACE FUNCTION public.get_team_note_count(p_group_id uuid, p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM public.contact_notes
    WHERE group_id = p_group_id
      AND source = 'supporter_observation'
      AND created_at > now() - (p_days || ' days')::interval
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_note_count(uuid, integer) TO authenticated;
