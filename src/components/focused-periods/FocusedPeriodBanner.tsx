import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, X } from "lucide-react";
import { formatDate } from "@/lib/formatDate";
import { useToast } from "@/hooks/use-toast";

interface FocusedPeriod {
  id: string;
  trigger_type: string;
  reason_category: string;
  reason_text: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  initiated_by: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

const REASON_LABELS: Record<string, string> = {
  feeling_off: "Feeling off",
  sleep_changes: "Sleep changes",
  mood_shift: "Mood shift",
  medication_concern: "Medication concern",
  team_observation: "Team observation",
  routine_disruption: "Routine disruption",
  other: "Other",
};

interface Props {
  groupId: string;
  /** "person" for PersonPortal, "coordinator" for GroupDashboard */
  variant: "person" | "coordinator";
  onAcknowledge?: () => void;
}

export default function FocusedPeriodBanner({ groupId, variant, onAcknowledge }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [periods, setPeriods] = useState<FocusedPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPeriods = async () => {
    const { data } = await (supabase as any)
      .from("focused_periods")
      .select("id, trigger_type, reason_category, reason_text, starts_at, ends_at, status, initiated_by, acknowledged_by, acknowledged_at")
      .eq("group_id", groupId)
      .in("status", ["active", "pending_ack"])
      .order("created_at", { ascending: false });
    setPeriods(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchPeriods(); }, [groupId]);

  const handleAcknowledge = async (periodId: string, accept: boolean) => {
    try {
      const updateData: any = accept
        ? { status: "active", acknowledged_by: user?.id, acknowledged_at: new Date().toISOString() }
        : { status: "declined", declined: true };
      const { error } = await (supabase as any)
        .from("focused_periods")
        .update(updateData)
        .eq("id", periodId);
      if (error) throw error;
      toast({ title: accept ? "Focused period accepted" : "Declined", description: accept ? "Your team will be more available during this time." : "That's okay. Your team will continue supporting you as usual." });
      fetchPeriods();
      onAcknowledge?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleEndEarly = async (periodId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("focused_periods")
        .update({ status: "ended_early", ended_early_by: user?.id, ended_early_at: new Date().toISOString() })
        .eq("id", periodId);
      if (error) throw error;
      toast({ title: "Focused period ended" });
      fetchPeriods();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading || periods.length === 0) return null;

  const activePeriods = periods.filter(p => p.status === "active");
  const pendingPeriods = periods.filter(p => p.status === "pending_ack");

  return (
    <>
      {/* Pending acknowledgment cards (person portal only) */}
      {variant === "person" && pendingPeriods.map(p => (
        <Card key={p.id} className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 space-y-3">
            <p className="text-sm font-medium">Your team has suggested a focused support period.</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Reason: {REASON_LABELS[p.reason_category] ?? p.reason_category}</p>
              {p.reason_text && <p className="italic">"{p.reason_text}"</p>}
              <p>Duration: {formatDate(p.starts_at)} – {formatDate(p.ends_at)}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              During this time, more information will be shared openly so the whole team can be more responsive.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleAcknowledge(p.id, true)}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => handleAcknowledge(p.id, false)}>Not right now</Button>
            </div>
            <p className="text-xs text-muted-foreground">Either way, your team is here for you.</p>
          </CardContent>
        </Card>
      ))}

      {/* Active period banners */}
      {activePeriods.map(p => {
        const daysRemaining = Math.max(0, Math.ceil((new Date(p.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        return (
          <div key={p.id} className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
            <Heart className="h-4 w-4 text-primary shrink-0" />
            <span className="text-foreground font-medium flex-1">
              Focused support active · {daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining
            </span>
            {variant === "coordinator" && (
              <Badge variant="secondary" className="text-xs">{REASON_LABELS[p.reason_category]}</Badge>
            )}
            {(variant === "person" || variant === "coordinator") && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleEndEarly(p.id)}>
                End early
              </Button>
            )}
          </div>
        );
      })}

      {/* Pending badge for coordinators */}
      {variant === "coordinator" && pendingPeriods.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
          <Heart className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-foreground">
            {pendingPeriods.length} focused {pendingPeriods.length === 1 ? "period" : "periods"} awaiting person acknowledgment
          </span>
        </div>
      )}
    </>
  );
}
