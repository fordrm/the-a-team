import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronRight, ChevronDown, Search, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { INDICATOR_CATEGORIES } from "@/lib/indicators";
import { useGroupSettings } from "@/hooks/useGroupSettings";

const CHANNELS = ["call", "text", "in-person", "video", "other"] as const;
const VISIBILITY_TIERS = [
  { value: "shared_with_person", label: "Shared with person" },
  { value: "supporters_only", label: "Supporters only" },
  { value: "restricted", label: "Restricted (coordinators)" },
] as const;

const REASON_CATEGORIES = [
  { value: "mood_shift", label: "Mood shift" },
  { value: "sleep_disruption", label: "Sleep disruption" },
  { value: "communication_change", label: "Communication change" },
  { value: "safety_concern", label: "Safety concern" },
  { value: "logistics", label: "Logistics" },
  { value: "other", label: "Other" },
] as const;

interface Props {
  groupId: string;
  personId: string;
  onBack: () => void;
  onCreated: () => void;
}

export default function AddNote({ groupId, personId, onBack, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const { data: groupSettings } = useGroupSettings(groupId);

  const isCollaborative = !groupSettings || groupSettings.operating_mode === "collaborative";

  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [channel, setChannel] = useState<string>("");
  const [visibility, setVisibility] = useState("supporters_only");
  const [body, setBody] = useState("");
  const [reasonCategory, setReasonCategory] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [indicators, setIndicators] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [indicatorFilter, setIndicatorFilter] = useState("");

  const toggleIndicator = (key: string) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const activeCount = (categoryId: string) => {
    const cat = INDICATOR_CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return 0;
    return cat.indicators.filter(i => indicators[i.key]).length;
  };

  const totalActiveCount = useMemo(() => {
    return Object.values(indicators).filter(Boolean).length;
  }, [indicators]);

  const filterLower = indicatorFilter.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (isCollaborative && !reasonCategory) {
      toast({ title: "Required", description: "Please select a reason category.", variant: "destructive" });
      return;
    }
    if (isCollaborative && reasonText.trim().length < 10) {
      toast({ title: "Required", description: "Brief explanation must be at least 10 characters.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("contact_notes").insert({
        group_id: groupId,
        subject_person_id: personId,
        author_user_id: user.id,
        visibility_tier: visibility,
        consent_level: "supporter_reported",
        channel: channel || null,
        occurred_at: new Date(occurredAt).toISOString(),
        indicators,
        body,
        reason_category: isCollaborative ? reasonCategory : null,
        reason_text: isCollaborative && reasonText.trim() ? reasonText.trim() : null,
      });
      if (error) throw error;
      toast({ title: "Note added" });
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
        <CardTitle className="text-lg">{isCollaborative ? "Log a concern" : "Add Contact Note"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason fields — collaborative mode only */}
          {isCollaborative && (
            <>
              <div className="space-y-2">
                <Label>What's this about? <span className="text-destructive">*</span></Label>
                <RadioGroup value={reasonCategory} onValueChange={setReasonCategory}>
                  {REASON_CATEGORIES.map(rc => (
                    <div key={rc.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={rc.value} id={`reason-${rc.value}`} />
                      <Label htmlFor={`reason-${rc.value}`} className="font-normal cursor-pointer">{rc.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Brief explanation <span className="text-destructive">*</span></Label>
                <Textarea
                  value={reasonText}
                  onChange={e => setReasonText(e.target.value)}
                  placeholder="1-2 sentences about why you're noting this"
                  rows={2}
                  required
                  minLength={10}
                />
                <p className="text-xs text-muted-foreground">Minimum 10 characters</p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>When did this occur?</Label>
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={e => setOccurredAt(e.target.value)}
              max={new Date().toISOString().slice(0, 16)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
              <SelectContent>
                {CHANNELS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIBILITY_TIERS.map(v => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea required value={body} onChange={e => setBody(e.target.value)} placeholder="What happened?" rows={4} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Indicators</Label>
              {totalActiveCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalActiveCount} flagged
                </Badge>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter indicators..."
                value={indicatorFilter}
                onChange={e => setIndicatorFilter(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              {INDICATOR_CATEGORIES.map(category => {
                const filteredIndicators = filterLower
                  ? category.indicators.filter(i => i.label.toLowerCase().includes(filterLower))
                  : category.indicators;

                if (filteredIndicators.length === 0) return null;

                const count = activeCount(category.id);
                const isExpanded = filterLower ? true : !!expandedCategories[category.id];

                return (
                  <div key={category.id} className="rounded-md border">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={`h-2 w-2 rounded-full ${category.color.replace("text-", "bg-")}`} />
                        <span>{category.label}</span>
                      </div>
                      {count > 0 && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5">
                          {count}
                        </Badge>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t px-3 pb-2 pt-1 space-y-1">
                        {filteredIndicators.map(({ key, label, tip }) => (
                          <div key={key} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted/30">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{label}</span>
                              {tip && (
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-muted-foreground cursor-help">
                                        <HelpCircle className="h-3.5 w-3.5" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs text-sm">
                                      {tip}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <Switch
                              checked={!!indicators[key]}
                              onCheckedChange={() => toggleIndicator(key)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save Note"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
