import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { signOutAndReset } from "@/lib/signOut";

interface MembershipRow {
  group_id: string;
}

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    const routeUser = async () => {
      // Query all three in parallel
      const [coordRes, personRes, memberRes] = await Promise.all([
        supabase.from("groups").select("id").eq("created_by_user_id", user.id).limit(1),
        supabase.from("persons").select("id").eq("user_id", user.id).limit(1),
        supabase.from("group_memberships").select("group_id").eq("user_id", user.id).eq("is_active", true),
      ]);

      const coordinatorGroups = coordRes.data ?? [];
      const supportedPerson = personRes.data ?? [];
      const memberships = (memberRes.data ?? []) as MembershipRow[];

      if (coordinatorGroups.length > 0) {
        navigate(`/group/${coordinatorGroups[0].id}`, { replace: true });
      } else if (supportedPerson.length > 0) {
        navigate("/person-portal", { replace: true });
      } else if (memberships.length > 0) {
        if (memberships.length === 1) {
          navigate(`/group/${memberships[0].group_id}`, { replace: true });
        } else {
          setChecking(false); // show picker
        }
      } else {
        navigate("/awaiting-approval", { replace: true });
      }
    };

    routeUser();
  }, [user, loading, navigate]);

  if (loading || checking) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading…</p></div>;
  }

  return <GroupPicker />;
}

function GroupPicker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("group_memberships")
      .select("group_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(async ({ data }) => {
        const ids = (data ?? []).map((d: any) => d.group_id);
        if (ids.length === 0) return;
        const { data: groupsData } = await supabase
          .from("groups")
          .select("id, name")
          .in("id", ids);
        setGroups(groupsData ?? []);
      });
  }, [user]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-2xl font-bold">Select a Group</h1>
        <div className="space-y-2">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => navigate(`/group/${g.id}`)}
              className="w-full rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent"
            >
              {g.name}
            </button>
          ))}
        </div>
        <div className="text-center">
          <button onClick={() => signOutAndReset()} className="text-sm text-muted-foreground hover:underline">Sign Out</button>
        </div>
      </div>
    </div>
  );
}
