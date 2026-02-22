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
  onCreated: (agreementId: string) => void;
}

export default function CreateAgreement({ groupId, personId, onBack, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("create_agreement_with_version", {
        p_group_id: groupId,
        p_subject_person_id: personId,
        p_title: title,
        p_body: body,
        p_created_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Agreement created" });
      onCreated(data as string);
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
        <CardTitle className="text-lg">New Agreement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Agreement title" />
          </div>
          <div className="space-y-2">
            <Label>Terms</Label>
            <Textarea required value={body} onChange={e => setBody(e.target.value)} placeholder="Describe the agreement terms" rows={6} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Creating…" : "Create Agreement"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
