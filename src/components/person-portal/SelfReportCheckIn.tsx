import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Send, Lock } from "lucide-react";
import { SELF_REPORT_CATEGORIES } from "@/lib/selfReportLabels";

interface SelfReportCheckInProps {
  personId: string;
  groupId: string;
  onSaved: () => void;
}

export default function SelfReportCheckIn({ personId, groupId, onSaved }: SelfReportCheckInProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [indicators, setIndicators] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const toggleIndicator = (key: string) => {
    setIndicators(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const activeCount = Object.keys(indicators).filter(k => indicators[k]).length;

  const canSubmit = body.trim().length > 0 || activeCount > 0;

  const handleSave = async (share: boolean) => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      // Create private self-report note
      const { data: privateNote, error } = await (supabase as any)
        .from("contact_notes")
        .insert({
          group_id: groupId,
          subject_person_id: personId,
          author_user_id: user.id,
          body: body.trim(),
          indicators: indicators,
          visibility_tier: "private_to_person",
          source: "self_report",
          channel: "self_report",
          consent_level: "self_reported",
        })
        .select("id")
        .single();

      if (error) throw error;

      if (share && privateNote) {
        // Create shared snapshot
        const { error: shareError } = await (supabase as any)
          .from("contact_notes")
          .insert({
            group_id: groupId,
            subject_person_id: personId,
            author_user_id: user.id,
            body: body.trim(),
            indicators: indicators,
            visibility_tier: "shared_with_person",
            source: "shared_snapshot",
            channel: "shared_snapshot",
            consent_level: "self_reported",
            shared_from_id: privateNote.id,
          });
        if (shareError) throw shareError;
      }

      toast({
        title: share ? "Saved & shared with your team" : "Saved privately",
      });
      setBody("");
      setIndicators({});
      onSaved();
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">How are you doing today?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="What's on your mind?"
          rows={3}
          className="text-base sm:text-sm"
        />

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">
            Optional: Check any that apply {activeCount > 0 && `(${activeCount} selected)`}
          </p>
          <div className="space-y-1">
            {SELF_REPORT_CATEGORIES.map(cat => {
              const catActive = cat.indicators.filter(i => indicators[i.key]).length;
              return (
                <Collapsible
                  key={cat.id}
                  open={openCategories[cat.id]}
                  onOpenChange={() => toggleCategory(cat.id)}
                >
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-2 rounded-md hover:bg-muted/50 text-sm font-medium">
                    <ChevronRight className={`h-4 w-4 transition-transform ${openCategories[cat.id] ? "rotate-90" : ""}`} />
                    <span className={`h-2 w-2 rounded-full ${cat.color.replace("text-", "bg-")}`} />
                    {cat.label}
                    {catActive > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground">{catActive}</span>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-8 pb-2 space-y-1">
                    {cat.indicators.map(ind => (
                      <label
                        key={ind.key}
                        className="flex items-start gap-2 py-1.5 cursor-pointer min-h-[44px]"
                      >
                        <Checkbox
                          checked={!!indicators[ind.key]}
                          onCheckedChange={() => toggleIndicator(ind.key)}
                          className="mt-0.5"
                        />
                        <span className="text-sm leading-snug">{ind.selfLabel}</span>
                      </label>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pb-[env(safe-area-inset-bottom)]">
          <Button
            variant="outline"
            className="flex-1 min-h-[44px]"
            onClick={() => handleSave(false)}
            disabled={submitting || !canSubmit}
          >
            <Lock className="mr-1.5 h-4 w-4" />
            {submitting ? "Saving…" : "Save privately"}
          </Button>
          <Button
            className="flex-1 min-h-[44px]"
            onClick={() => handleSave(true)}
            disabled={submitting || !canSubmit}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {submitting ? "Saving…" : "Save & Share"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
