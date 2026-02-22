import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/formatDate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

interface Props {
  contradictionId: string;
  groupId: string;
  isCoordinator: boolean;
  onBack: () => void;
}

export default function ContradictionDetail({ contradictionId, groupId, isCoordinator, onBack }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [item, setItem] = useState<any>(null);
  const [linkedNotes, setLinkedNotes] = useState<any[]>([]);
  const [linkedAgreements, setLinkedAgreements] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // resolve form
  const [newStatus, setNewStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contradictions")
      .select("*")
      .eq("id", contradictionId)
      .single();
    setItem(data);

    if (data) {
      // fetch linked notes
      const noteIds: string[] = data.related_note_ids ?? [];
      if (noteIds.length > 0) {
        const { data: nd } = await supabase
          .from("contact_notes")
          .select("id, body, occurred_at, author_user_id")
          .in("id", noteIds);
        setLinkedNotes(nd ?? []);
      }
      // fetch linked agreements
      const agrIds: string[] = data.related_agreement_ids ?? [];
      const agrs: { id: string; title: string }[] = [];
      for (const aid of agrIds) {
        const { data: vd } = await supabase
          .from("agreement_versions")
          .select("fields")
          .eq("agreement_id", aid)
          .order("version_num", { ascending: false })
          .limit(1);
        const fields = vd?.[0]?.fields as any;
        agrs.push({ id: aid, title: fields?.title || "Untitled" });
      }
      setLinkedAgreements(agrs);
      setNewStatus(data.status);
      setResolution(data.resolution || "");
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [contradictionId]);

  const handleResolve = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates: any = { status: newStatus, resolution: resolution || null };
      if (newStatus === "resolved" || newStatus === "dismissed") {
        updates.resolved_by_user_id = user.id;
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("contradictions")
        .update(updates)
        .eq("id", contradictionId);
      if (error) throw error;
      toast({ title: "Contradiction updated" });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!item) return <p className="text-sm text-muted-foreground">Not found.</p>;

  const severityVariant = (s: string) => {
    if (s === "high") return "destructive" as const;
    if (s === "medium") return "secondary" as const;
    return "outline" as const;
  };

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{item.summary}</CardTitle>
          <Badge variant={severityVariant(item.severity)} className="text-xs">{item.severity}</Badge>
          <Badge variant="outline" className="text-xs">{item.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{item.type.replace(/_/g, " ")} · {formatDateTime(item.created_at)}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {item.details && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Details</p>
            <p className="text-sm">{item.details}</p>
          </div>
        )}

        {linkedNotes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Linked Notes</p>
            <ul className="space-y-1">
              {linkedNotes.map(n => (
                <li key={n.id} className="rounded border p-2 text-sm">
                  <span className="text-xs text-muted-foreground">{formatDateTime(n.occurred_at)}</span>
                  <p>{n.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {linkedAgreements.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Linked Agreements</p>
            <ul className="space-y-1">
              {linkedAgreements.map(a => (
                <li key={a.id} className="rounded border px-2 py-1 text-sm font-medium">{a.title}</li>
              ))}
            </ul>
          </div>
        )}

        {item.resolution && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Resolution</p>
            <p className="text-sm">{item.resolution}</p>
          </div>
        )}

        {/* Coordinator actions */}
        {isCoordinator && (
          <div className="border-t pt-3 space-y-3">
            <p className="text-sm font-medium">Update Status</p>
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Resolution Notes</Label>
              <Textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={2} />
            </div>
            <Button size="sm" onClick={handleResolve} disabled={saving}>
              {saving ? "Saving…" : "Update"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
