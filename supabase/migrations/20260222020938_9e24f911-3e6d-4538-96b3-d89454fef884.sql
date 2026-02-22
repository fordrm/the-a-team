
-- Allow members to update their own display_name
CREATE POLICY "Members can update own display_name"
ON public.group_memberships FOR UPDATE
USING (is_group_member(auth.uid(), group_id) AND user_id = auth.uid())
WITH CHECK (is_group_member(auth.uid(), group_id) AND user_id = auth.uid());

-- Allow coordinators to update any member's display_name in their group
CREATE POLICY "Coordinators can update member display_name"
ON public.group_memberships FOR UPDATE
USING (is_group_coordinator(auth.uid(), group_id))
WITH CHECK (is_group_coordinator(auth.uid(), group_id));
