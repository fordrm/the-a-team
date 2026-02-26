import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const REASON_OPTIONS = [
  { value: "team_observation", label: "Team observation" },
  { value: "feeling_off", label: "Person seems off" },
  { value: "sleep_changes", label: "Sleep changes noticed" },
  { value: "mood_shift", label: "Mood shift noticed" },
  { value: "medication_concern", label: "Medication concern" },
  { value: "routine_disruption", label: "Routine disruption" },
  { value: "other", label: "Other" },
];

interface Props {
  groupId: string;
  onCreated: () => void;
}

export default function ProposeFocusedPeriod({ groupId, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("team_observation");
  const [reasonText, setReasonText] = useState("");
  const [duration, setDuration] = useState("7");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const startsAt = new Date();
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + parseInt(duration));

      const { error } = await (supabase as any)
        .from("focused_periods")
        .insert({
          group_id: groupId,
          trigger_type: "team_proposed",
          initiated_by: user.id,
          reason_category: reason,
          reason_text: reasonText.trim() || null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: "pending_ack",
        });
      if (error) throw error;
      toast({ title: "Focused period proposed", description: "The person will be asked to acknowledge this." });
      setOpen(false);
      setReason("team_observation");
      setReasonText("");
      setDuration("7");
      onCreated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Heart className="mr-1 h-4 w-4" /> Propose Focused Period
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propose a Focused Support Period</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background z-50">
                {REASON_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Explanation (optional)</Label>
            <Textarea
              placeholder="We've noticed some changes and want to be more available."
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background z-50">
                {Array.from({ length: 14 }, (_, i) => i + 1).map(d => (
                  <SelectItem key={d} value={String(d)}>{d} {d === 1 ? "day" : "days"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            The person will be asked to acknowledge this. If they decline, the team can still coordinate — but the system won't elevate sharing.
          </p>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Proposing…" : "Propose Period"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
