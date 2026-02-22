import { useEffect, useState } from "react";
import { formatDate } from "@/lib/formatDate";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Activity } from "lucide-react";

interface InterventionRow {
  id: string;
  title: string;
  type: string;
  status: string;
  severity?: string;
  visibility_tier: string;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
}

interface Props {
  groupId: string;
  personId: string | null;
  onCreateNew: () => void;
  onView: (id: string) => void;
}

const STATUSES = ["all", "planned", "started", "ongoing", "completed", "stopped"] as const;
const TYPES = ["all", "clinical", "support_action", "environmental", "social", "routine_disruption", "stressor", "other"] as const;

const statusColor = (s: string) => {
  switch (s) {
    case "planned": return "secondary";
    case "started": case "ongoing": return "default";
    case "completed": return "outline";
    case "stopped": return "destructive";
    default: return "secondary";
  }
};

export default function InterventionsList({ groupId, personId, onCreateNew, onView }: Props) {
  const [items, setItems] = useState<InterventionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!personId) { setItems([]); setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      let q = supabase
        .from("interventions")
        .select("id, title, type, status, visibility_tier, start_at, end_at, created_at")
        .eq("group_id", groupId)
        .eq("subject_person_id", personId)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (typeFilter !== "all") q = q.eq("type", typeFilter);
      const { data } = await q;
      setItems(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [groupId, personId, statusFilter, typeFilter]);

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-medium text-sm">Choose a supported person</p>
          <p className="text-sm text-muted-foreground mt-1">Select who you're coordinating for to view their interventions.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" /> Interventions
        </CardTitle>
        <Button size="sm" variant="outline" onClick={onCreateNew}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t === "all" ? "All types" : t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No interventions found.</p>
        ) : (
          <ul className="space-y-2">
            {items.map(i => (
              <li
                key={i.id}
                onClick={() => onView(i.id)}
                className="cursor-pointer rounded-md border p-3 space-y-1 hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{i.title}</span>
                  <Badge variant={statusColor(i.status)} className="text-xs">{i.status}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{i.type.replace(/_/g, " ")}</Badge>
                  <span>{i.visibility_tier.replace(/_/g, " ")}</span>
                  {i.start_at && <span>from {formatDate(i.start_at)}</span>}
                  {i.end_at && <span>to {formatDate(i.end_at)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
