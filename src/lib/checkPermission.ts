import { supabase } from "@/integrations/supabase/client";

/**
 * Re-validates the caller's role at mutation time.
 * Prevents stale-permission exploits where a user's role was revoked
 * but they still have the page open from before revocation.
 */
export async function checkPermission(
  userId: string,
  groupId: string,
  subjectPersonId?: string
) {
  const [memberRes, personRes] = await Promise.all([
    supabase
      .from("group_memberships")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    subjectPersonId
      ? supabase
          .from("persons")
          .select("user_id")
          .eq("id", subjectPersonId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    isMember: !!memberRes.data,
    isCoordinator: memberRes.data?.role === "coordinator",
    isSubjectPerson: personRes.data?.user_id === userId,
  };
}
