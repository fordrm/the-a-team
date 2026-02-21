import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

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

    // Check memberships
    supabase
      .from("group_memberships")
      .select("group_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        const memberships = (data ?? []) as MembershipRow[];
        if (memberships.length === 0) {
          navigate("/create-group", { replace: true });
        } else if (memberships.length === 1) {
          navigate(`/group/${memberships[0].group_id}`, { replace: true });
        } else {
          // multiple groups — stay here as picker
          setChecking(false);
        }
      });
  }, [user, loading, navigate]);

  if (loading || checking) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading…</p></div>;
  }

  // Multiple groups picker
  return <GroupPicker />;
}

function GroupPicker() {
  const { user, signOut } = useAuth();
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
        <div className="flex justify-between">
          <button onClick={() => navigate("/create-group")} className="text-sm text-primary hover:underline">+ New Group</button>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:underline">Sign Out</button>
        </div>
      </div>
    </div>
  );
}
