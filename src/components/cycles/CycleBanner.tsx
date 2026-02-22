import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarRange } from "lucide-react";

interface CycleBannerProps {
  groupId: string;
  personId: string | null;
}

interface CycleRow {
  id: string;
  label: string;
  start_date: string;
  expected_end: string | null;
  status: string;
  reason: string | null;
}

export default function CycleBanner({ groupId, personId }: CycleBannerProps) {
  const [cycle, setCycle] = useState<CycleRow | null>(null);

  useEffect(() => {
    if (!personId) { setCycle(null); return; }
    (async () => {
      const { data } = await supabase
        .from("tracking_cycles")
        .select("id, label, start_date, expected_end, status, reason")
        .eq("group_id", groupId)
        .eq("person_id", personId)
        .eq("status", "active")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCycle(data);
    })();
  }, [groupId, personId]);

  if (!cycle) return null;

  const start = new Date(cycle.start_date);
  const today = new Date();
  const dayNumber = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  let durationText = `Day ${dayNumber}`;
  if (cycle.expected_end) {
    const end = new Date(cycle.expected_end);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    durationText = `Day ${dayNumber} of ~${totalDays}`;
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
      <CalendarRange className="h-4 w-4 text-primary shrink-0" />
      <span className="font-medium">{cycle.label}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{durationText}</span>
      {cycle.reason && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground italic truncate">{cycle.reason}</span>
        </>
      )}
    </div>
  );
}
