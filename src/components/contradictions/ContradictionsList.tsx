import { useEffect, useState } from "react";
import { formatDate } from "@/lib/formatDate";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus } from "lucide-react";

interface ContradictionRow {
  id: string;
  status: string;
  severity: string;
  type: string;
  summary: string;
  created_at: string;
}

interface Props {
  groupId: string;
  personId: string | null;
  onCreateNew: () => void;
  onView: (id: string) => void;
}

const severityVariant = (s: string) => {
  if (s === "high") return "destructive" as const;
  if (s === "medium") return "secondary" as const;
  return "outline" as const;
};

export default function ContradictionsList({ groupId, personId, onCreateNew, onView }: Props) {
  const [items, setItems] = useState<ContradictionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!personId) { setItems([]); setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      let q = supabase
        .from("contradictions")
        .select("id, status, severity, type, summary, created_at")
        .eq("group_id", groupId)
        .eq("subject_person_id", personId)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data } = await q;
      setItems(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [groupId, personId, statusFilter]);

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-medium text-sm">Choose a supported person</p>
          <p className="text-sm text-muted-foreground mt-1">Select who you're coordinating for to view their conflicts.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-primary" /> Contradictions
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={onCreateNew}>
            <Plus className="mr-1 h-4 w-4" /> Flag
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contradictions found.</p>
        ) : (
          <ul className="space-y-2">
            {items.map(c => (
              <li
                key={c.id}
                onClick={() => onView(c.id)}
                className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <div className="space-y-0.5">
                  <span className="font-medium">{c.summary}</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{c.type}</span>
                    <span>·</span>
                    <span>{formatDate(c.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={severityVariant(c.severity)} className="text-xs">{c.severity}</Badge>
                  <Badge variant="outline" className="text-xs">{c.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
