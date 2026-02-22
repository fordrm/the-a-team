import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/formatDate";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Clock, Plus, ChevronDown, Eye, EyeOff, Shield, Activity } from "lucide-react";

interface NoteRow {
  id: string;
  author_user_id: string;
  visibility_tier: string;
  channel: string | null;
  occurred_at: string;
  indicators: Record<string, boolean>;
  body: string;
  created_at: string;
}

interface InterventionRow {
  id: string;
  title: string;
  type: string;
  status: string;
  visibility_tier: string;
  start_at: string | null;
  created_at: string;
  created_by_user_id: string;
}

type TimelineItem =
  | { kind: "note"; date: string; data: NoteRow }
  | { kind: "intervention"; date: string; data: InterventionRow };

interface Props {
  groupId: string;
  personId: string | null;
  members: { user_id: string; display_name: string | null }[];
  onAddNote: () => void;
  isGroupMember?: boolean;
}

const visibilityIcon = (tier: string) => {
  if (tier === "shared_with_person") return <Eye className="h-3 w-3" />;
  if (tier === "restricted") return <Shield className="h-3 w-3" />;
  return <EyeOff className="h-3 w-3" />;
};

const visibilityLabel = (tier: string) => {
  if (tier === "shared_with_person") return "Shared";
  if (tier === "restricted") return "Restricted";
  return "Supporters only";
};

export default function Timeline({ groupId, personId, members, onAddNote, isGroupMember = true }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) { setItems([]); setLoading(false); return; }
    const fetchAll = async () => {
      setLoading(true);
      const [notesRes, intRes] = await Promise.all([
        supabase
          .from("contact_notes")
          .select("id, author_user_id, visibility_tier, channel, occurred_at, indicators, body, created_at")
          .eq("group_id", groupId)
          .eq("subject_person_id", personId)
          .order("occurred_at", { ascending: false }),
        supabase
          .from("interventions")
          .select("id, title, type, status, visibility_tier, start_at, created_at, created_by_user_id")
          .eq("group_id", groupId)
          .eq("subject_person_id", personId),
      ]);

      const noteItems: TimelineItem[] = ((notesRes.data as NoteRow[] | null) ?? []).map(n => ({
        kind: "note" as const,
        date: n.occurred_at,
        data: n,
      }));

      const intItems: TimelineItem[] = ((intRes.data as InterventionRow[] | null) ?? []).map(i => ({
        kind: "intervention" as const,
        date: i.start_at || i.created_at,
        data: i,
      }));

      const combined = [...noteItems, ...intItems].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setItems(combined);
      setLoading(false);
    };
    fetchAll();
  }, [groupId, personId]);

  const authorName = (uid: string) => {
    const m = members.find(m => m.user_id === uid);
    return m?.display_name || uid.slice(0, 8) + "…";
  };

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-medium text-sm">Choose a supported person</p>
          <p className="text-sm text-muted-foreground mt-1">Select who you're coordinating for to view their timeline.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading timeline…</p>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" /> Timeline
        </CardTitle>
        {isGroupMember && (
          <Button size="sm" variant="outline" onClick={onAddNote} disabled={!personId}>
            <Plus className="mr-1 h-4 w-4" /> Add Note
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timeline events yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map(item => {
              if (item.kind === "note") {
                const n = item.data;
                const indicatorKeys = Object.entries(n.indicators || {})
                  .filter(([, v]) => v)
                  .map(([k]) => k.replace(/_/g, " "));
                return (
                  <li key={`note-${n.id}`} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{authorName(n.author_user_id)}</span>
                        {n.channel && <Badge variant="outline" className="text-xs">{n.channel}</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          {visibilityIcon(n.visibility_tier)}
                          {visibilityLabel(n.visibility_tier)}
                        </span>
                        <span>{formatDateTime(n.occurred_at)}</span>
                      </div>
                    </div>
                    <p className="text-sm">{n.body}</p>
                    {indicatorKeys.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <ChevronDown className="h-3 w-3" /> Indicators ({indicatorKeys.length})
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1 flex flex-wrap gap-1">
                          {indicatorKeys.map(k => (
                            <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </li>
                );
              } else {
                const i = item.data;
                return (
                  <li key={`int-${i.id}`} className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3 text-primary" />
                        <span className="font-medium text-foreground">Intervention</span>
                        <Badge variant="outline" className="text-xs">{i.type.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs">{i.status}</Badge>
                        <span>{formatDateTime(item.date)}</span>
                      </div>
                    </div>
                    <p className="text-sm font-medium">{i.title}</p>
                  </li>
                );
              }
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
