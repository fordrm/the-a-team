import { useEffect, useState, useMemo } from "react";
import { formatRelativeTime, formatFullDateTime } from "@/lib/formatTime";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Plus, ChevronDown, Eye, EyeOff, Shield, Activity, Pin, FileText, Check, Pencil, X, XCircle } from "lucide-react";
import { INDICATOR_LABEL_MAP, ALL_INDICATORS } from "@/lib/indicators";

interface NoteRow {
  id: string;
  author_user_id: string;
  visibility_tier: string;
  channel: string | null;
  occurred_at: string;
  indicators: Record<string, boolean>;
  body: string;
  created_at: string;
  pinned: boolean;
}

interface InterventionRow {
  id: string;
  title: string;
  type: string;
  status: string;
  visibility_tier: string;
  start_at: string | null;
  created_at: string;
  created_by_user_id: string;
}

interface AgreementEventRow {
  id: string;
  agreement_id: string;
  status: string;
  message: string | null;
  person_user_id: string;
  created_at: string;
  agreement_title: string;
}

type TimelineItem =
  | { kind: "note"; date: string; data: NoteRow }
  | { kind: "intervention"; date: string; data: InterventionRow }
  | { kind: "agreement_event"; date: string; data: AgreementEventRow };

interface Props {
  groupId: string;
  personId: string | null;
  members: { user_id: string; display_name: string | null }[];
  onAddNote: () => void;
  isGroupMember?: boolean;
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(uid: string): string {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
    "bg-indigo-100 text-indigo-700",
    "bg-orange-100 text-orange-700",
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash) + uid.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

function sortItems(items: TimelineItem[]): TimelineItem[] {
  return [...items].sort((a, b) => {
    const aPinned = a.kind === "note" && (a.data as NoteRow).pinned;
    const bPinned = b.kind === "note" && (b.data as NoteRow).pinned;
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

const AGREEMENT_STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  created: { icon: <FileText className="h-3 w-3 text-blue-500" />, label: "Agreement created", color: "border-blue-200 bg-blue-50" },
  accepted: { icon: <Check className="h-3 w-3 text-green-500" />, label: "Agreement accepted", color: "border-green-200 bg-green-50" },
  modified: { icon: <Pencil className="h-3 w-3 text-amber-500" />, label: "Modification proposed", color: "border-amber-200 bg-amber-50" },
  declined: { icon: <X className="h-3 w-3 text-red-500" />, label: "Agreement declined", color: "border-red-200 bg-red-50" },
  withdrawn: { icon: <XCircle className="h-3 w-3 text-gray-500" />, label: "Agreement withdrawn", color: "border-gray-200 bg-gray-50" },
};

export default function Timeline({ groupId, personId, members, onAddNote, isGroupMember = true }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterVisibility, setFilterVisibility] = useState("all");
  const [filterHasIndicators, setFilterHasIndicators] = useState(false);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    if (!personId) { setItems([]); setLoading(false); return; }
    const fetchAll = async () => {
      setLoading(true);
      const [notesRes, intRes, accRes, agreeRes] = await Promise.all([
        supabase
          .from("contact_notes")
          .select("id, author_user_id, visibility_tier, channel, occurred_at, indicators, body, created_at, pinned")
          .eq("group_id", groupId)
          .eq("subject_person_id", personId)
          .order("occurred_at", { ascending: false }),
        supabase
          .from("interventions")
          .select("id, title, type, status, visibility_tier, start_at, created_at, created_by_user_id")
          .eq("group_id", groupId)
          .eq("subject_person_id", personId),
        supabase
          .from("agreement_acceptances")
          .select("id, agreement_id, status, message, person_user_id, created_at")
          .eq("group_id", groupId),
        supabase
          .from("agreements")
          .select("id, created_at, created_by_user_id, status")
          .eq("group_id", groupId)
          .eq("subject_person_id", personId),
      ]);

      const noteItems: TimelineItem[] = ((notesRes.data as NoteRow[] | null) ?? []).map(n => ({
        kind: "note" as const,
        date: n.occurred_at,
        data: n,
      }));

      const intItems: TimelineItem[] = ((intRes.data as InterventionRow[] | null) ?? []).map(i => ({
        kind: "intervention" as const,
        date: i.start_at || i.created_at,
        data: i,
      }));

      // Build agreement title map
      const agreementIds = (agreeRes.data ?? []).map((a: any) => a.id);
      let titleMap: Record<string, string> = {};
      if (agreementIds.length > 0) {
        const { data: versionsData } = await supabase
          .from("agreement_versions")
          .select("agreement_id, fields")
          .in("agreement_id", agreementIds)
          .order("version_num", { ascending: false });
        (versionsData ?? []).forEach((v: any) => {
          if (!titleMap[v.agreement_id]) {
            titleMap[v.agreement_id] = v.fields?.title || "Untitled Agreement";
          }
        });
      }

      // Filter acceptances to only those for this person's agreements
      const agreementIdSet = new Set(agreementIds);
      const rawAcceptances = (accRes.data ?? []).filter((a: any) => agreementIdSet.has(a.agreement_id));

      const acceptanceItems: TimelineItem[] = rawAcceptances.map((a: any) => ({
        kind: "agreement_event" as const,
        date: a.created_at,
        data: {
          id: a.id,
          agreement_id: a.agreement_id,
          status: a.status,
          message: a.message,
          person_user_id: a.person_user_id,
          created_at: a.created_at,
          agreement_title: titleMap[a.agreement_id] || "Agreement",
        } as AgreementEventRow,
      }));

      const creationItems: TimelineItem[] = (agreeRes.data ?? []).map((a: any) => ({
        kind: "agreement_event" as const,
        date: a.created_at,
        data: {
          id: `created-${a.id}`,
          agreement_id: a.id,
          status: "created",
          message: null,
          person_user_id: a.created_by_user_id,
          created_at: a.created_at,
          agreement_title: titleMap[a.id] || "Agreement",
        } as AgreementEventRow,
      }));

      setItems(sortItems([...noteItems, ...intItems, ...acceptanceItems, ...creationItems]));
      setLoading(false);
    };
    fetchAll();
  }, [groupId, personId]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filterType === "notes" && item.kind !== "note") return false;
      if (filterType === "interventions" && item.kind !== "intervention") return false;
      if (filterType === "agreements" && item.kind !== "agreement_event") return false;

      if (item.kind === "note") {
        const n = item.data as NoteRow;
        if (filterChannel !== "all" && n.channel !== filterChannel) return false;
        if (filterVisibility !== "all" && n.visibility_tier !== filterVisibility) return false;
        if (filterHasIndicators) {
          const active = Object.values(n.indicators || {}).some(Boolean);
          if (!active) return false;
        }
      }

      return true;
    });
  }, [items, filterChannel, filterVisibility, filterHasIndicators, filterType]);

  const authorName = (uid: string) => {
    const m = members.find(m => m.user_id === uid);
    return m?.display_name || uid.slice(0, 8) + "…";
  };

  const togglePin = async (noteId: string, currentlyPinned: boolean) => {
    const { error } = await supabase
      .from("contact_notes")
      .update({ pinned: !currentlyPinned })
      .eq("id", noteId);
    if (!error) {
      setItems(prev =>
        sortItems(prev.map(item => {
          if (item.kind === "note" && item.data.id === noteId) {
            return { ...item, data: { ...item.data, pinned: !currentlyPinned } };
          }
          return item;
        }))
      );
    }
  };

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-medium text-sm">Choose a supported person</p>
          <p className="text-sm text-muted-foreground mt-1">Select who you're coordinating for to view their timeline.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading timeline…</p>;

  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" /> Timeline
        </CardTitle>
      </CardHeader>

      {/* Filter bar */}
      {items.length > 0 && (
        <div className="px-6 pb-3 flex flex-wrap gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="notes">Notes only</SelectItem>
              <SelectItem value="interventions">Interventions</SelectItem>
              <SelectItem value="agreements">Agreements</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterChannel} onValueChange={setFilterChannel}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="in-person">In-person</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterVisibility} onValueChange={setFilterVisibility}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All visibility</SelectItem>
              <SelectItem value="shared_with_person">Shared</SelectItem>
              <SelectItem value="supporters_only">Supporters only</SelectItem>
              <SelectItem value="restricted">Restricted</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={filterHasIndicators ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setFilterHasIndicators(!filterHasIndicators)}
          >
            {filterHasIndicators ? "⚑ With indicators" : "⚐ Indicators"}
          </Button>
        </div>
      )}

      <CardContent>
        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? "No timeline events yet." : "No items match the current filters."}
          </p>
        ) : (
          <TooltipProvider>
            <ul className="space-y-3">
              {filteredItems.map(item => {
                if (item.kind === "note") {
                  const n = item.data;
                  const indicatorKeys = Object.entries(n.indicators || {})
                    .filter(([, v]) => v)
                    .map(([k]) => INDICATOR_LABEL_MAP[k] || k.replace(/_/g, " "));
                  const name = authorName(n.author_user_id);
                  return (
                    <li key={`note-${n.id}`} className={`rounded-md border p-3 space-y-2 ${n.pinned ? "border-primary/30 bg-primary/5" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarColor(n.author_user_id)}`}>
                          {getInitials(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">{name}</span>
                              {n.pinned && <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">Pinned</Badge>}
                              {n.channel && <Badge variant="outline" className="text-xs">{n.channel}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => togglePin(n.id, n.pinned)}
                                className={`hover:text-primary transition-colors ${n.pinned ? "text-primary" : "text-muted-foreground"}`}
                                title={n.pinned ? "Unpin note" : "Pin note"}
                              >
                                <Pin className="h-3 w-3" />
                              </button>
                              <span className="flex items-center gap-1">
                                {visibilityIcon(n.visibility_tier)}
                                {visibilityLabel(n.visibility_tier)}
                              </span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>{formatRelativeTime(n.occurred_at)}</span>
                                </TooltipTrigger>
                                <TooltipContent>{formatFullDateTime(n.occurred_at)}</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm pl-11">{n.body}</p>
                      {indicatorKeys.length > 0 && (
                        <div className="pl-11">
                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                              <ChevronDown className="h-3 w-3" /> Indicators ({indicatorKeys.length})
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-1 flex flex-wrap gap-1">
                              {indicatorKeys.map(k => {
                                const def = ALL_INDICATORS.find(i => i.label === k || i.key === k);
                                return (
                                  <Badge key={k} variant="secondary" className="text-xs cursor-help" title={def?.tip || ""}>
                                    {k}
                                  </Badge>
                                );
                              })}
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      )}
                    </li>
                  );
                } else if (item.kind === "intervention") {
                  const i = item.data;
                  return (
                    <li key={`int-${i.id}`} className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Activity className="h-3 w-3 text-primary" />
                          <span className="font-medium text-foreground">Intervention</span>
                          <Badge variant="outline" className="text-xs">{i.type.replace(/_/g, " ")}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs">{i.status}</Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{formatRelativeTime(item.date)}</span>
                            </TooltipTrigger>
                            <TooltipContent>{formatFullDateTime(item.date)}</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      <p className="text-sm font-medium">{i.title}</p>
                    </li>
                  );
                } else if (item.kind === "agreement_event") {
                  const e = item.data as AgreementEventRow;
                  const config = AGREEMENT_STATUS_CONFIG[e.status] || AGREEMENT_STATUS_CONFIG.created;
                  return (
                    <li key={`agree-${e.id}`} className={`rounded-md border p-3 space-y-1 ${config.color}`}>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {config.icon}
                          <span className="font-medium text-foreground">{config.label}</span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{formatRelativeTime(e.created_at)}</span>
                          </TooltipTrigger>
                          <TooltipContent>{formatFullDateTime(e.created_at)}</TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-sm font-medium">{e.agreement_title}</p>
                      {e.message && <p className="text-sm text-muted-foreground italic">"{e.message}"</p>}
                      <p className="text-xs text-muted-foreground">by {authorName(e.person_user_id)}</p>
                    </li>
                  );
                }
                return null;
              })}
            </ul>
          </TooltipProvider>
        )}
      </CardContent>

      {/* Floating quick-add button */}
      {isGroupMember && personId && (
        <div className="absolute bottom-4 right-4">
          <Button size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={onAddNote}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      )}
    </Card>
  );
}
