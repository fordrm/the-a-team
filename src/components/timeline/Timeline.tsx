import React, { useEffect, useState, useMemo } from "react";
import { formatRelativeTime, formatFullDateTime, getDateGroupLabel } from "@/lib/formatTime";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Plus, ChevronDown, ChevronRight, Eye, EyeOff, Shield, Activity, Pin, FileText, Check, Pencil, X, XCircle, Paperclip, AlertTriangle, User, CalendarRange, Tag } from "lucide-react";
import { INDICATOR_LABEL_MAP, ALL_INDICATORS, getIndicatorBadgeColor } from "@/lib/indicators";
import { formatCadenceDisplay, formatDurationDisplay, computeFieldDiffs } from "@/types/agreements";
import type { VersionFields, FieldDiff } from "@/types/agreements";
import { PLAN_LABELS } from "@/lib/planLabels";

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
  cycle_id: string | null;
  reason_category: string | null;
  reason_text: string | null;
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

interface CollapsedAgreement {
  agreement_id: string;
  title: string;
  i_will_statement?: string;
  cadence_display?: string;
  duration_display?: string;
  terminal_status: string;
  terminal_date: string;
  events: AgreementEventRow[];
  diffs: FieldDiff[];
  first_version_fields?: VersionFields;
  final_version_fields?: VersionFields;
  created_by: string;
  resolved_by?: string;
}

type TimelineItem =
  | { kind: "note"; date: string; data: NoteRow }
  | { kind: "intervention"; date: string; data: InterventionRow }
  | { kind: "agreement_event"; date: string; data: AgreementEventRow }
  | { kind: "agreement_collapsed"; date: string; data: CollapsedAgreement };

interface Props {
  groupId: string;
  personId: string | null;
  members: { user_id: string; display_name: string | null }[];
  onAddNote: () => void;
  isGroupMember?: boolean;
  lastSeenAt?: string | null;
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

const AGREEMENT_STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  created: { icon: <FileText className="h-3 w-3 text-blue-500" />, label: PLAN_LABELS.eventCreated },
  accepted: { icon: <Check className="h-3 w-3 text-green-500" />, label: PLAN_LABELS.eventAccepted },
  modified: { icon: <Pencil className="h-3 w-3 text-amber-500" />, label: PLAN_LABELS.eventModified },
  declined: { icon: <X className="h-3 w-3 text-red-500" />, label: PLAN_LABELS.eventDeclined },
  withdrawn: { icon: <XCircle className="h-3 w-3 text-gray-500" />, label: PLAN_LABELS.eventWithdrawn },
  completed: { icon: <Check className="h-3 w-3 text-green-600" />, label: PLAN_LABELS.eventCompleted },
  incomplete: { icon: <AlertTriangle className="h-3 w-3 text-amber-500" />, label: PLAN_LABELS.eventIncomplete },
  lapsed: { icon: <Clock className="h-3 w-3 text-gray-400" />, label: PLAN_LABELS.eventLapsed },
  review_needed: { icon: <Clock className="h-3 w-3 text-amber-500" />, label: PLAN_LABELS.eventReviewNeeded },
  self_assessed: { icon: <User className="h-3 w-3 text-blue-500" />, label: PLAN_LABELS.eventSelfAssessed },
};

export default function Timeline({ groupId, personId, members, onAddNote, isGroupMember = true, lastSeenAt }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [personName, setPersonName] = useState<string | null>(null);
  const [personUserId, setPersonUserId] = useState<string | null>(null);
  const [cycleLabelMap, setCycleLabelMap] = useState<Record<string, string>>({});

  // Filters
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterVisibility, setFilterVisibility] = useState("all");
  const [filterHasIndicators, setFilterHasIndicators] = useState(false);
  const [filterType, setFilterType] = useState("all");

  // Pagination
  const PAGE_SIZE = 20;
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!personId) { setItems([]); setLoading(false); return; }
    const fetchAll = async () => {
      setLoading(true);
      const [notesRes, intRes, accRes, agreeRes] = await Promise.all([
        supabase
          .from("contact_notes")
          .select("id, author_user_id, visibility_tier, channel, occurred_at, indicators, body, created_at, pinned, cycle_id, reason_category, reason_text")
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

      const agreementIds = (agreeRes.data ?? []).map((a: any) => a.id);
      let titleMap: Record<string, string> = {};
      let versionsMap: Record<string, VersionFields[]> = {};

      if (agreementIds.length > 0) {
        const { data: versionsData } = await supabase
          .from("agreement_versions")
          .select("agreement_id, version_num, fields")
          .in("agreement_id", agreementIds)
          .order("version_num", { ascending: true });

        (versionsData ?? []).forEach((v: any) => {
          if (!versionsMap[v.agreement_id]) versionsMap[v.agreement_id] = [];
          versionsMap[v.agreement_id].push(v.fields as VersionFields);
          // titleMap uses latest version title
          titleMap[v.agreement_id] = v.fields?.title || titleMap[v.agreement_id] || "Untitled Commitment";
        });
      }

      const agreementIdSet = new Set(agreementIds);
      const rawAcceptances = (accRes.data ?? []).filter((a: any) => agreementIdSet.has(a.agreement_id));

      // Group agreement events by agreement_id into collapsed cards
      const agreementEventsMap: Record<string, AgreementEventRow[]> = {};

      (agreeRes.data ?? []).forEach((a: any) => {
        const event: AgreementEventRow = {
          id: `created-${a.id}`,
          agreement_id: a.id,
          status: "created",
          message: null,
          person_user_id: a.created_by_user_id,
          created_at: a.created_at,
          agreement_title: titleMap[a.id] || "Commitment",
        };
        if (!agreementEventsMap[a.id]) agreementEventsMap[a.id] = [];
        agreementEventsMap[a.id].push(event);
      });

      rawAcceptances.forEach((a: any) => {
        const event: AgreementEventRow = {
          id: a.id,
          agreement_id: a.agreement_id,
          status: a.status,
          message: a.message,
          person_user_id: a.person_user_id,
          created_at: a.created_at,
          agreement_title: titleMap[a.agreement_id] || "Commitment",
        };
        if (!agreementEventsMap[a.agreement_id]) agreementEventsMap[a.agreement_id] = [];
        agreementEventsMap[a.agreement_id].push(event);
      });

      const collapsedItems: TimelineItem[] = Object.entries(agreementEventsMap).map(([agId, events]) => {
        const sorted = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const newest = sorted[0];
        const oldest = sorted[sorted.length - 1];

        const versions = versionsMap[agId] || [];
        const firstFields = versions[0];
        const finalFields = versions[versions.length - 1] || firstFields;

        const diffs = firstFields && finalFields && versions.length > 1
          ? computeFieldDiffs(firstFields, finalFields)
          : [];

        const collapsed: CollapsedAgreement = {
          agreement_id: agId,
          title: finalFields?.title || titleMap[agId] || "Commitment",
          i_will_statement: finalFields?.i_will_statement,
          cadence_display: finalFields ? formatCadenceDisplay(finalFields) : undefined,
          duration_display: finalFields ? formatDurationDisplay(finalFields) : undefined,
          terminal_status: newest.status,
          terminal_date: newest.created_at,
          events: sorted,
          diffs,
          first_version_fields: firstFields,
          final_version_fields: finalFields,
          created_by: oldest.person_user_id,
          resolved_by: newest.status !== "created" ? newest.person_user_id : undefined,
        };

        return {
          kind: "agreement_collapsed" as const,
          date: newest.created_at,
          data: collapsed,
        };
      });

      if (personId) {
        const { data: personData } = await supabase
          .from("persons")
          .select("label, user_id")
          .eq("id", personId)
          .maybeSingle();
        if (personData) {
          setPersonName(personData.label);
          setPersonUserId(personData.user_id);
        }
      }

      // Fetch cycle labels for any notes tagged to a cycle
      const cycleIdsInNotes = [...new Set(
        ((notesRes.data as NoteRow[] | null) ?? [])
          .map(n => n.cycle_id)
          .filter(Boolean) as string[]
      )];
      if (cycleIdsInNotes.length > 0) {
        const { data: cycleData } = await supabase
          .from("tracking_cycles")
          .select("id, label")
          .in("id", cycleIdsInNotes);
        const newMap: Record<string, string> = {};
        (cycleData || []).forEach((c: any) => { newMap[c.id] = c.label; });
        setCycleLabelMap(newMap);
      }

      setItems(sortItems([...noteItems, ...intItems, ...collapsedItems]));
      setLoading(false);
    };
    fetchAll();
  }, [groupId, personId]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filterType === "notes" && item.kind !== "note") return false;
      if (filterType === "interventions" && item.kind !== "intervention") return false;
      if (filterType === "agreements" && item.kind !== "agreement_event" && item.kind !== "agreement_collapsed") return false;

      if (item.kind === "agreement_collapsed") return true;

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

  const visibleItems = useMemo(() => {
    return filteredItems.slice(0, displayCount);
  }, [filteredItems, displayCount]);

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [filterChannel, filterVisibility, filterHasIndicators, filterType]);

  const authorName = (uid: string) => {
    const m = members.find(m => m.user_id === uid);
    if (m?.display_name) return m.display_name;
    if (personUserId && uid === personUserId && personName) return personName;
    return uid.slice(0, 8) + "…";
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
        <div className="px-3 sm:px-6 pb-3 flex flex-wrap gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="notes">Notes only</SelectItem>
              <SelectItem value="interventions">Interventions</SelectItem>
              <SelectItem value="agreements">Commitments</SelectItem>
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
              {visibleItems.map((item, index) => {
                const currentGroup = getDateGroupLabel(item.date);
                const prevGroup = index > 0 ? getDateGroupLabel(visibleItems[index - 1].date) : null;
                const showDateHeader = currentGroup !== prevGroup;

                const dateHeader = showDateHeader ? (
                  <li key={`date-${currentGroup}-${index}`} className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm flex items-center gap-3 py-1.5 -mx-1 px-1">
                    <div className="flex-1 border-t border-border" />
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{currentGroup}</span>
                    <div className="flex-1 border-t border-border" />
                  </li>
                ) : null;

                const isNew = lastSeenAt ? new Date(item.date) > new Date(lastSeenAt) : false;
                const prevIsNew = index > 0 && lastSeenAt
                  ? new Date(visibleItems[index - 1].date) > new Date(lastSeenAt)
                  : false;
                const showNewDivider = index > 0 && !isNew && prevIsNew;

                const newDivider = showNewDivider ? (
                  <li key={`new-divider-${index}`} className="flex items-center gap-3 py-1">
                    <div className="flex-1 border-t border-blue-300" />
                    <span className="text-xs font-medium text-blue-500 whitespace-nowrap">New since last visit ↑</span>
                    <div className="flex-1 border-t border-blue-300" />
                  </li>
                ) : null;

                const newClass = isNew ? "border-l-2 border-l-blue-400" : "";

                let itemElement: React.ReactNode = null;

                if (item.kind === "note") {
                  const n = item.data;
                  const indicatorKeys = Object.entries(n.indicators || {})
                    .filter(([, v]) => v)
                    .map(([k]) => INDICATOR_LABEL_MAP[k] || k.replace(/_/g, " "));
                  const name = authorName(n.author_user_id);
                  itemElement = (
                    <li key={`note-${n.id}`} className={`rounded-md border p-3 space-y-2 ${n.pinned ? "border-primary/30 bg-primary/5" : ""} ${newClass}`}>
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
                              {n.cycle_id && cycleLabelMap[n.cycle_id] && (
                                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                                  <CalendarRange className="h-2.5 w-2.5 mr-0.5" />
                                  {cycleLabelMap[n.cycle_id]}
                                </Badge>
                              )}
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
                      {/* Reason badge */}
                      {n.reason_category && (
                        <div className="pl-11 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Tag className="h-3 w-3" />
                          <span className="font-medium">{n.reason_category.replace(/_/g, " ")}</span>
                          {n.reason_text && <span>· "{n.reason_text}"</span>}
                        </div>
                      )}
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
                                const colorClasses = getIndicatorBadgeColor(def?.key || k);
                                return (
                                  <Badge key={k} variant="outline" className={`text-xs cursor-help ${colorClasses}`} title={def?.tip || ""}>
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
                  itemElement = (
                    <li key={`int-${i.id}`} className={`rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1 ${newClass}`}>
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
                } else if (item.kind === "agreement_collapsed") {
                  const c = item.data as CollapsedAgreement;
                  const terminalConfig = AGREEMENT_STATUS_CONFIG[c.terminal_status] || AGREEMENT_STATUS_CONFIG.created;

                  const summaryLabel =
                    c.terminal_status === "completed" ? "Agreement completed" :
                    c.terminal_status === "incomplete" ? "Agreement incomplete" :
                    c.terminal_status === "lapsed" ? "Agreement lapsed" :
                    c.terminal_status === "review_needed" ? "Review due" :
                    c.terminal_status === "accepted" && c.events.length > 1
                    ? "Agreement finalized"
                    : c.terminal_status === "accepted"
                    ? "Agreement accepted"
                    : c.terminal_status === "declined"
                    ? "Agreement declined"
                    : c.terminal_status === "withdrawn"
                    ? "Agreement withdrawn"
                    : c.terminal_status === "modified"
                    ? "Awaiting response"
                    : c.terminal_status === "self_assessed"
                    ? "Self-assessment submitted"
                    : "Agreement proposed";

                  const participants = [
                    authorName(c.created_by),
                    c.resolved_by && c.resolved_by !== c.created_by ? authorName(c.resolved_by) : null,
                  ].filter(Boolean).join(" → ");

                  itemElement = (
                    <li key={`agree-collapsed-${c.agreement_id}`} className={`rounded-md border border-border/60 p-3 space-y-2 ${newClass}`}>
                      {/* Header */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          {terminalConfig.icon}
                          <span>{summaryLabel}</span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground">{formatRelativeTime(c.terminal_date)}</span>
                          </TooltipTrigger>
                          <TooltipContent>{formatFullDateTime(c.terminal_date)}</TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Restated agreement — wraps on mobile */}
                      <div className="text-sm leading-relaxed">
                        <span className="font-medium">{c.title}</span>
                        {c.i_will_statement && (
                          <span className="text-muted-foreground block sm:inline">
                            <span className="hidden sm:inline"> · </span>
                            <span className="italic">"{c.i_will_statement}"</span>
                          </span>
                        )}
                        {c.cadence_display && (
                          <span className="text-muted-foreground block sm:inline">
                            <span className="hidden sm:inline"> · </span>
                            {c.cadence_display}
                          </span>
                        )}
                        {c.duration_display && (
                          <span className="text-muted-foreground block sm:inline">
                            <span className="hidden sm:inline"> · </span>
                            {c.duration_display}
                          </span>
                        )}
                      </div>

                      {/* Field diffs */}
                      {c.diffs.length > 0 && (
                        <div className="space-y-0.5">
                          {c.diffs.slice(0, 3).map((d, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              <Paperclip className="inline h-3 w-3 mr-1" />
                              {d.label}: <span className="line-through">{d.oldValue}</span>{" → "}<span className="font-medium text-foreground">{d.newValue}</span>
                            </p>
                          ))}
                          {c.diffs.length > 3 && (
                            <p className="text-xs text-muted-foreground italic">and {c.diffs.length - 3} more changes</p>
                          )}
                        </div>
                      )}

                      {/* Expandable event history */}
                      {c.events.length > 1 && (
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                            <ChevronRight className="h-3 w-3 transition-transform ui-open:rotate-90" />
                            {c.events.length} events · {participants}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-1.5 pl-4 border-l-2 border-border">
                            {c.events.map(ev => {
                              const evConfig = AGREEMENT_STATUS_CONFIG[ev.status] || AGREEMENT_STATUS_CONFIG.created;
                              return (
                                <div key={ev.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                                  {evConfig.icon}
                                  <span className="font-medium text-foreground">{evConfig.label}</span>
                                  {ev.message && <span className="italic">— "{ev.message}"</span>}
                                  <span className="ml-auto text-muted-foreground/70">
                                    {authorName(ev.person_user_id)} · {formatRelativeTime(ev.created_at)}
                                  </span>
                                </div>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Single event — just show participants */}
                      {c.events.length === 1 && (
                        <p className="text-xs text-muted-foreground">{participants}</p>
                      )}
                    </li>
                  );
                } else if (item.kind === "agreement_event") {
                  // Fallback for ungrouped events (shouldn't normally fire)
                  const e = item.data as AgreementEventRow;
                  const config = AGREEMENT_STATUS_CONFIG[e.status] || AGREEMENT_STATUS_CONFIG.created;
                  itemElement = (
                    <li key={`agree-${e.id}`} className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground ${newClass}`}>
                      {config.icon}
                      <span className="font-medium text-foreground">{config.label}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="text-foreground">{e.agreement_title}</span>
                      {e.message && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="italic">"{e.message}"</span>
                        </>
                      )}
                      <span className="ml-auto flex items-center gap-1.5 shrink-0">
                        <span>{authorName(e.person_user_id)}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{formatRelativeTime(e.created_at)}</span>
                          </TooltipTrigger>
                          <TooltipContent>{formatFullDateTime(e.created_at)}</TooltipContent>
                        </Tooltip>
                      </span>
                    </li>
                  );
                }

                return (
                  <React.Fragment key={`frag-${item.kind}-${item.kind === "note" ? item.data.id : item.kind === "intervention" ? item.data.id : item.kind === "agreement_collapsed" ? (item.data as CollapsedAgreement).agreement_id : (item.data as AgreementEventRow).id}`}>
                    {dateHeader}
                    {newDivider}
                    {itemElement}
                  </React.Fragment>
                );
              })}
            </ul>
          </TooltipProvider>
        )}

        {filteredItems.length > displayCount && (
          <div className="flex justify-center pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisplayCount(prev => prev + PAGE_SIZE)}
            >
              Show more ({filteredItems.length - displayCount} remaining)
            </Button>
          </div>
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
