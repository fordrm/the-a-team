import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

interface Props {
  groupId: string;
  personId: string;
  onBack: () => void;
  onCreated: () => void;
}

export default function CreateAgreement({ groupId, personId, onBack, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [iWill, setIWill] = useState("");
  const [metric, setMetric] = useState("");
  const [cadence, setCadence] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [support, setSupport] = useState("");
  const [renegotiation, setRenegotiation] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      // 1. create agreement
      const { data: agr, error: agrErr } = await supabase
        .from("agreements")
        .insert({
          group_id: groupId,
          subject_person_id: personId,
          created_by_user_id: user.id,
          status: "proposed",
        })
        .select("id")
        .single();
      if (agrErr) throw agrErr;

      // 2. create version 1
      const fields = {
        title,
        i_will_statement: iWill,
        metric_definition: metric,
        cadence_or_due_date: cadence,
        check_in_method: checkIn,
        support_needed: support,
        renegotiation_trigger: renegotiation,
      };
      const { error: vErr } = await supabase
        .from("agreement_versions")
        .insert({
          agreement_id: agr.id,
          group_id: groupId,
          proposed_by_user_id: user.id,
          version_num: 1,
          fields,
        });
      if (vErr) throw vErr;

      toast({ title: "Agreement proposed" });
      onCreated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <CardTitle className="text-lg">New SMART Agreement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Agreement title" />
          </div>
          <div className="space-y-2">
            <Label>I will…</Label>
            <Textarea required value={iWill} onChange={e => setIWill(e.target.value)} placeholder="What the person commits to" />
          </div>
          <div className="space-y-2">
            <Label>Metric / Definition of Done</Label>
            <Input value={metric} onChange={e => setMetric(e.target.value)} placeholder="How success is measured" />
          </div>
          <div className="space-y-2">
            <Label>Cadence / Due Date</Label>
            <Input value={cadence} onChange={e => setCadence(e.target.value)} placeholder="e.g. Weekly, by March 1" />
          </div>
          <div className="space-y-2">
            <Label>Check-in Method</Label>
            <Input value={checkIn} onChange={e => setCheckIn(e.target.value)} placeholder="e.g. Text message, app log" />
          </div>
          <div className="space-y-2">
            <Label>Support Needed</Label>
            <Textarea value={support} onChange={e => setSupport(e.target.value)} placeholder="What support is required" />
          </div>
          <div className="space-y-2">
            <Label>Renegotiation Trigger</Label>
            <Input value={renegotiation} onChange={e => setRenegotiation(e.target.value)} placeholder="When to revisit this agreement" />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Propose Agreement"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
