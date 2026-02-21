import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Clock, Plus, ChevronDown, Eye, EyeOff, Shield } from "lucide-react";

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

interface Props {
  groupId: string;
  personId: string | null;
  members: { user_id: string; display_name: string | null }[];
  onAddNote: () => void;
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

export default function Timeline({ groupId, personId, members, onAddNote }: Props) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) { setNotes([]); setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("contact_notes")
        .select("id, author_user_id, visibility_tier, channel, occurred_at, indicators, body, created_at")
        .eq("group_id", groupId)
        .eq("subject_person_id", personId)
        .order("occurred_at", { ascending: false });
      setNotes((data as NoteRow[] | null) ?? []);
      setLoading(false);
    };
    fetch();
  }, [groupId, personId]);

  const authorName = (uid: string) => {
    const m = members.find(m => m.user_id === uid);
    return m?.display_name || uid.slice(0, 8) + "…";
  };

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Select a supported person to view timeline.
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
        <Button size="sm" variant="outline" onClick={onAddNote}>
          <Plus className="mr-1 h-4 w-4" /> Add Note
        </Button>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contact notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map(n => {
              const indicatorKeys = Object.entries(n.indicators || {})
                .filter(([, v]) => v)
                .map(([k]) => k.replace(/_/g, " "));
              return (
                <li key={n.id} className="rounded-md border p-3 space-y-2">
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
                      <span>{new Date(n.occurred_at).toLocaleString()}</span>
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
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
