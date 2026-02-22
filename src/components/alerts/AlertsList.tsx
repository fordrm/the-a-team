import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ensureUnresolvedContradictionAlert } from "@/lib/alertsService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell } from "lucide-react";

interface AlertRow {
  id: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  created_at: string;
}

interface Props {
  groupId: string;
  personId: string | null;
  isCoordinator: boolean;
  onView: (id: string) => void;
}

const STATUSES = ["all", "open", "acknowledged", "resolved", "dismissed"] as const;
const SEVERITIES = ["all", "tier1", "tier2", "tier3", "tier4"] as const;
const TYPES = ["all", "contradiction_opened", "agreement_modified", "agreement_declined", "intervention_stopped", "pattern_signal"] as const;

const severityColor = (s: string): "destructive" | "default" | "secondary" | "outline" => {
  switch (s) {
    case "tier1": return "destructive";
    case "tier2": return "default";
    case "tier3": return "secondary";
    default: return "outline";
  }
};

const statusColor = (s: string): "destructive" | "default" | "secondary" | "outline" => {
  switch (s) {
    case "open": return "destructive";
    case "acknowledged": return "default";
    case "resolved": return "secondary";
    default: return "outline";
  }
};

export default function AlertsList({ groupId, personId, isCoordinator, onView }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Pattern signal: check for unresolved contradictions > 24h (coordinator only)
  useEffect(() => {
    if (!personId || !isCoordinator || !user) return;
    ensureUnresolvedContradictionAlert(groupId, personId);
  }, [groupId, personId, isCoordinator, user]);

  useEffect(() => {
    if (!personId) { setItems([]); setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      let q = supabase
        .from("alerts")
        .select("id, title, type, severity, status, created_at")
        .eq("group_id", groupId)
        .eq("subject_person_id", personId)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (severityFilter !== "all") q = q.eq("severity", severityFilter);
      if (typeFilter !== "all") q = q.eq("type", typeFilter);
      const { data } = await q;
      setItems(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [groupId, personId, statusFilter, severityFilter, typeFilter]);

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-medium text-sm">Choose a supported person</p>
          <p className="text-sm text-muted-foreground mt-1">Select who you're coordinating for to view their alerts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary" /> Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s === "all" ? "All tiers" : s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t === "all" ? "All types" : t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts found.</p>
        ) : (
          <ul className="space-y-2">
            {items.map(a => (
              <li
                key={a.id}
                onClick={() => onView(a.id)}
                className="cursor-pointer rounded-md border p-3 space-y-1 hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{a.title}</span>
                  <Badge variant={statusColor(a.status)} className="text-xs">{a.status}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={severityColor(a.severity)} className="text-xs">{a.severity}</Badge>
                  <Badge variant="outline" className="text-xs">{a.type.replace(/_/g, " ")}</Badge>
                  <span>{new Date(a.created_at).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
