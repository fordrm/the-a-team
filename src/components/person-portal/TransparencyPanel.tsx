import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Heart } from "lucide-react";
import { formatDate } from "@/lib/formatDate";

interface Props {
  personId: string;
  groupId: string;
}

interface FocusedPeriod {
  id: string;
  reason_category: string;
  starts_at: string;
  ends_at: string;
}

const REASON_LABELS: Record<string, string> = {
  feeling_off: "Feeling off",
  sleep_changes: "Sleep changes",
  mood_shift: "Mood shift",
  medication_concern: "Medication concern",
  team_observation: "Team observation",
  routine_disruption: "Routine disruption",
  sleep_disruption: "Sleep disruption",
  communication_change: "Communication change",
  safety_concern: "Safety concern",
  logistics: "Logistics",
  other: "Other",
};

export default function TransparencyPanel({ personId, groupId }: Props) {
  const { user } = useAuth();
  const [checkInCount, setCheckInCount] = useState(0);
  const [sharedCount, setSharedCount] = useState(0);
  const [teamNoteTotal, setTeamNoteTotal] = useState(0);
  const [teamNoteCategories, setTeamNoteCategories] = useState<Record<string, number>>({});
  const [activePeriods, setActivePeriods] = useState<FocusedPeriod[]>([]);
  const [totalPeriods, setTotalPeriods] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    const fetchCounts = async () => {
      const [checkIns, shared, teamSummary, activeP, totalP] = await Promise.all([
        // Self-report check-ins
        (supabase as any)
          .from("contact_notes")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("subject_person_id", personId)
          .eq("source", "self_report")
          .gte("created_at", since),
        // Shared snapshots
        (supabase as any)
          .from("contact_notes")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("subject_person_id", personId)
          .eq("source", "shared_snapshot")
          .gte("created_at", since),
        // Team note summary via RPC
        supabase.rpc("get_team_note_summary", { p_group_id: groupId, p_days: 30 }),
        // Active focused periods
        (supabase as any)
          .from("focused_periods")
          .select("id, reason_category, starts_at, ends_at")
          .eq("group_id", groupId)
          .eq("status", "active"),
        // Total focused periods
        (supabase as any)
          .from("focused_periods")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId),
      ]);

      setCheckInCount(checkIns.count ?? 0);
      setSharedCount(shared.count ?? 0);
      const summary = teamSummary.data as { total: number; by_category: Record<string, number> } | null;
      setTeamNoteTotal(summary?.total ?? 0);
      setTeamNoteCategories(summary?.by_category ?? {});
      setActivePeriods(activeP.data ?? []);
      setTotalPeriods(totalP.count ?? 0);
      setLoaded(true);
    };

    fetchCounts();
  }, [user, personId, groupId]);

  if (!loaded) return null;

  return (
    <Card className="bg-muted/40 border-border">
      <CardContent className="py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold">What I Can See</h3>
        </div>

        {/* Static explainer */}
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>This is your space. Here's how it works:</p>

          <p>
            <span className="font-medium text-foreground">Your check-ins are private.</span>{" "}
            When you check in, only you see the details unless you choose to share. Your team sees that you checked in, but not what you said.
          </p>

          <p>
            <span className="font-medium text-foreground">Your team keeps coordination notes.</span>{" "}
            These help them organize support without adding to your plate. You can always ask your coordinator what's being tracked and why.
          </p>

          <p>
            <span className="font-medium text-foreground">During a focused support period</span>, more is shared openly so the whole team can be more responsive. You'll always know when a focused period is active and why.
          </p>

          <p>If something doesn't feel right, tell your coordinator.</p>
        </div>

        {/* Dynamic counts */}
        <div className="rounded-md border border-border bg-background px-3 py-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">This month:</p>
          <ul className="text-sm space-y-0.5">
            <li>• Your check-ins: {checkInCount} (shared: {sharedCount})</li>
            <li>• Team coordination notes: {teamNoteTotal}</li>
            <li>• Focused support periods: {activePeriods.length} active / {totalPeriods} total</li>
          </ul>
          {Object.keys(teamNoteCategories).length > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              {Object.entries(teamNoteCategories)
                .filter(([cat]) => cat !== "uncategorized")
                .map(([cat, count]) => `${REASON_LABELS[cat] ?? cat}: ${count}`)
                .join(" · ")}
            </p>
          )}
        </div>

        {/* Active focused period detail */}
        {activePeriods.map(p => (
          <div key={p.id} className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Heart className="h-3.5 w-3.5 text-primary" />
              Focused support is active
            </div>
            <p className="text-xs text-muted-foreground">
              Started: {formatDate(p.starts_at)} · Ends: {formatDate(p.ends_at)}
            </p>
            <p className="text-xs text-muted-foreground">
              Reason: {REASON_LABELS[p.reason_category] ?? p.reason_category}
            </p>
            <p className="text-xs text-muted-foreground italic">
              During this time, your team may share more information openly so everyone can be more responsive.
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
