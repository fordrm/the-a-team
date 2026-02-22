import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const TYPES = ["clinical", "support_action", "environmental", "social", "routine_disruption", "stressor", "other"] as const;
const STATUSES = ["planned", "started", "ongoing", "completed", "stopped"] as const;
const VISIBILITY = ["shared_with_person", "supporters_only", "restricted"] as const;

interface Props {
  groupId: string;
  personId: string;
  onBack: () => void;
  onCreated: () => void;
}

export default function CreateIntervention({ groupId, personId, onBack, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("support_action");
  const [status, setStatus] = useState("planned");
  const [rationale, setRationale] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [visibility, setVisibility] = useState("supporters_only");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
      toast({ title: "Validation error", description: "End date must be after start date.", variant: "destructive" });
      setSaving(false);
      return;
    }
    try {
      const { error } = await supabase.from("interventions").insert({
        group_id: groupId,
        subject_person_id: personId,
        created_by_user_id: user.id,
        title,
        type,
        status,
        rationale: rationale || null,
        start_at: startAt || null,
        end_at: endAt || null,
        visibility_tier: visibility,
      });
      if (error) throw error;
      toast({ title: "Intervention logged" });
      onCreated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <CardTitle className="text-lg">Log Intervention</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief title" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIBILITY.map(v => <SelectItem key={v} value={v}>{v.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Rationale (optional)</Label>
            <Textarea value={rationale} onChange={e => setRationale(e.target.value)} placeholder="Why this intervention?" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start date (optional)</Label>
              <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End date (optional)</Label>
              <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Submit Intervention"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
