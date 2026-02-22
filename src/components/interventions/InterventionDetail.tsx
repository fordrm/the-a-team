import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

interface InterventionRow {
  id: string;
  title: string;
  type: string;
  status: string;
  rationale: string | null;
  start_at: string | null;
  end_at: string | null;
  visibility_tier: string;
  created_by_user_id: string;
  created_at: string;
  group_id: string;
  subject_person_id: string;
}

interface PrivateDetail {
  id: string;
  body: string;
  author_user_id: string;
  created_at: string;
}

const STATUSES = ["planned", "started", "ongoing", "completed", "stopped"] as const;

interface Props {
  interventionId: string;
  groupId: string;
  isCoordinator: boolean;
  onBack: () => void;
}

export default function InterventionDetail({ interventionId, groupId, isCoordinator, onBack }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [item, setItem] = useState<InterventionRow | null>(null);
  const [details, setDetails] = useState<PrivateDetail[]>([]);
  const [newStatus, setNewStatus] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      const { data } = await supabase
        .from("interventions")
        .select("*")
        .eq("id", interventionId)
        .single();
      if (data) {
        setItem(data as InterventionRow);
        setNewStatus(data.status);
      }
    };
    const fetchDetails = async () => {
      const { data } = await supabase
        .from("intervention_private_details")
        .select("id, body, author_user_id, created_at")
        .eq("intervention_id", interventionId)
        .order("created_at", { ascending: true });
      setDetails(data ?? []);
    };
    fetchItem();
    if (isCoordinator) fetchDetails();
  }, [interventionId, isCoordinator]);

  const handleUpdateStatus = async () => {
    if (!item || !newStatus) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("interventions")
        .update({ status: newStatus })
        .eq("id", item.id);
      if (error) throw error;
      setItem({ ...item, status: newStatus });
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleAddDetail = async () => {
    if (!item || !user || !newDetail.trim()) return;
    setSaving(true);
    try {
      const { error, data } = await supabase
        .from("intervention_private_details")
        .insert({
          intervention_id: item.id,
          group_id: item.group_id,
          subject_person_id: item.subject_person_id,
          author_user_id: user.id,
          body: newDetail.trim(),
        })
        .select("id, body, author_user_id, created_at")
        .single();
      if (error) throw error;
      if (data) setDetails(prev => [...prev, data]);
      setNewDetail("");
      toast({ title: "Private detail added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!item) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <CardTitle className="text-lg">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{item.type.replace(/_/g, " ")}</Badge>
          <Badge>{item.status}</Badge>
          <Badge variant="secondary">{item.visibility_tier.replace(/_/g, " ")}</Badge>
        </div>

        {item.rationale && (
          <div>
            <Label className="text-xs text-muted-foreground">Rationale</Label>
            <p className="text-sm mt-1">{item.rationale}</p>
          </div>
        )}

        <div className="flex gap-4 text-xs text-muted-foreground">
          {item.start_at && <span>Start: {new Date(item.start_at).toLocaleString()}</span>}
          {item.end_at && <span>End: {new Date(item.end_at).toLocaleString()}</span>}
          <span>Created: {new Date(item.created_at).toLocaleString()}</span>
        </div>

        {/* Coordinator: update status */}
        {isCoordinator && (
          <div className="border-t pt-4 space-y-3">
            <Label>Update Status</Label>
            <div className="flex gap-2">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleUpdateStatus} disabled={saving || newStatus === item.status}>
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Coordinator: private details */}
        {isCoordinator && (
          <div className="border-t pt-4 space-y-3">
            <Label>Private Details (coordinator only)</Label>
            {details.length > 0 && (
              <ul className="space-y-2">
                {details.map(d => (
                  <li key={d.id} className="rounded-md border p-2 text-sm space-y-1">
                    <p>{d.body}</p>
                    <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
            <Textarea
              value={newDetail}
              onChange={e => setNewDetail(e.target.value)}
              placeholder="Add private detail…"
              rows={2}
            />
            <Button size="sm" onClick={handleAddDetail} disabled={saving || !newDetail.trim()}>
              Add Detail
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
