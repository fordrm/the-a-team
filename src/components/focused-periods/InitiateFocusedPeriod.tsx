import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const REASON_OPTIONS = [
  { value: "feeling_off", label: "I'm feeling off" },
  { value: "sleep_changes", label: "Sleep has been different" },
  { value: "mood_shift", label: "Mood shift" },
  { value: "medication_concern", label: "Medication concern" },
  { value: "routine_disruption", label: "Routine disruption" },
  { value: "other", label: "Something else" },
];

const DURATION_OPTIONS = [
  { value: "3", label: "3 days" },
  { value: "4", label: "4 days" },
  { value: "5", label: "5 days" },
  { value: "6", label: "6 days" },
  { value: "7", label: "7 days" },
];

interface Props {
  groupId: string;
  onCreated: () => void;
}

export default function InitiateFocusedPeriod({ groupId, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [duration, setDuration] = useState("3");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setSaving(true);
    try {
      const startsAt = new Date();
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + parseInt(duration));

      const { error } = await (supabase as any)
        .from("focused_periods")
        .insert({
          group_id: groupId,
          trigger_type: "person_initiated",
          initiated_by: user.id,
          reason_category: reason,
          reason_text: reasonText.trim() || null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: "active",
        });
      if (error) throw error;
      toast({ title: "Focused support started", description: "Your team has been notified and will be more available." });
      setExpanded(false);
      setReason("");
      setReasonText("");
      setDuration("3");
      onCreated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Need extra support?</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
            Let my team know
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="py-4 space-y-4">
        <p className="text-sm font-medium">Start a focused support period</p>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">What's going on?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REASON_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant={reason === opt.value ? "default" : "outline"}
                className="h-10 justify-start text-xs"
                onClick={() => setReason(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Anything you want to share? (optional)</p>
          <Textarea
            className="text-base sm:text-sm"
            placeholder="What's on your mind?"
            value={reasonText}
            onChange={e => setReasonText(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">How long?</p>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {DURATION_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleSubmit} disabled={saving || !reason} className="flex-1 min-h-[44px]">
            {saving ? "Starting…" : "Start focused period"}
          </Button>
          <Button variant="outline" onClick={() => setExpanded(false)} className="min-h-[44px]">
            Cancel
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Your team will be notified and may share more with you during this time.
        </p>
      </CardContent>
    </Card>
  );
}
