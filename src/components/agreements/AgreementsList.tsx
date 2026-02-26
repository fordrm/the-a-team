import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Plus, ChevronDown } from "lucide-react";
import type { VersionFields } from "@/types/agreements";
import { formatCadenceDisplay, formatDurationDisplay, ACTIVE_STATUSES, PENDING_STATUSES, TERMINAL_STATUSES, type AgreementStatus } from "@/types/agreements";
import { PLAN_LABELS } from "@/lib/planLabels";

interface AgreementRow {
  id: string;
  subject_person_id: string;
  created_by_user_id: string;
  status: string;
  current_version_id: string | null;
  created_at: string;
  closure: any;
}

interface VersionRow {
  id: string;
  agreement_id: string;
  version_num: number;
  fields: VersionFields;
  proposed_by_user_id: string;
  created_at: string;
}

interface Props {
  groupId: string;
  personId: string | null;
  onCreateNew: () => void;
  onViewAgreement: (agreementId: string) => void;
  isGroupMember?: boolean;
}

export default function AgreementsList({ groupId, personId, onCreateNew, onViewAgreement, isGroupMember = true }: Props) {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [versions, setVersions] = useState<Record<string, VersionRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) { setAgreements([]); setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("agreements")
        .select("id, subject_person_id, created_by_user_id, status, current_version_id, created_at, closure")
        .eq("group_id", groupId)
        .eq("subject_person_id", personId);
      if (error) {
        console.error("AgreementsList fetch error:", error);
        setLoading(false);
        return;
      }
      const items = (data ?? []) as AgreementRow[];
      setAgreements(items);

      const versionMap: Record<string, VersionRow> = {};
      if (items.length > 0) {
        const agreementIds = items.map(a => a.id);
        const { data: allVersions, error: vError } = await supabase
          .from("agreement_versions")
          .select("id, agreement_id, version_num, fields, proposed_by_user_id, created_at")
          .in("agreement_id", agreementIds)
          .order("version_num", { ascending: false });

        if (!vError && allVersions) {
          for (const v of allVersions) {
            if (!versionMap[v.agreement_id]) {
              versionMap[v.agreement_id] = v as VersionRow;
            }
          }
        }
      }
      setVersions(versionMap);
      setLoading(false);
    };
    fetch();
  }, [groupId, personId]);

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-medium text-sm">Choose a supported person</p>
          <p className="text-sm text-muted-foreground mt-1">Select who you're coordinating for to view their agreements.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading agreements…</p>;

  const activeAgreements = agreements.filter(a => ACTIVE_STATUSES.includes(a.status as AgreementStatus));
  const pendingAgreements = agreements.filter(a => PENDING_STATUSES.includes(a.status as AgreementStatus));
  const closedAgreements = agreements.filter(a => TERMINAL_STATUSES.includes(a.status as AgreementStatus));

  const renderItem = (a: AgreementRow) => {
    const v = versions[a.id];
    const fields = v?.fields as VersionFields | undefined;
    return (
      <li
        key={a.id}
        onClick={() => onViewAgreement(a.id)}
        className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{fields?.title || "Untitled"}</span>
            {v && <span className="text-xs text-muted-foreground shrink-0">v{v.version_num}</span>}
          </div>
          {fields?.i_will_statement && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              "{fields.i_will_statement}"
              {fields.cadence ? ` · ${formatCadenceDisplay(fields)}` : fields.cadence_or_due_date ? ` · ${fields.cadence_or_due_date}` : ""}
              {fields.duration ? ` · ${formatDurationDisplay(fields)}` : ""}
            </p>
          )}
        </div>
        <div className="shrink-0 ml-2">
          {a.status === "review_needed" ? (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Review due</Badge>
          ) : a.status === "accepted" ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant={a.status === "proposed" ? "secondary" : "outline"}>{a.status}</Badge>
          )}
        </div>
      </li>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" /> {PLAN_LABELS.sectionTitle}
        </CardTitle>
        {isGroupMember && (
          <Button size="sm" variant="outline" onClick={onCreateNew} disabled={!personId}>
            <Plus className="mr-1 h-4 w-4" /> {PLAN_LABELS.createButton}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {agreements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{PLAN_LABELS.emptyActive}</p>
        ) : (
          <>
            {/* Active */}
            {activeAgreements.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{PLAN_LABELS.active}</span>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">{activeAgreements.length}</Badge>
                </div>
                <ul className="space-y-2">{activeAgreements.map(renderItem)}</ul>
              </div>
            )}

            {/* Pending */}
            {pendingAgreements.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{PLAN_LABELS.pending}</span>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">{pendingAgreements.length}</Badge>
                </div>
                <ul className="space-y-2">{pendingAgreements.map(renderItem)}</ul>
              </div>
            )}

            {/* Closed — collapsible */}
            {closedAgreements.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
                  <ChevronDown className="h-3 w-3" />
                  {PLAN_LABELS.closed}
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">{closedAgreements.length}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <ul className="space-y-2">
                    {closedAgreements.map(a => {
                      const v = versions[a.id];
                      const fields = v?.fields as VersionFields | undefined;
                      const closure = a.closure as any;
                      return (
                        <li
                          key={a.id}
                          onClick={() => onViewAgreement(a.id)}
                          className="flex cursor-pointer items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted transition-colors opacity-75"
                        >
                          <div className="min-w-0">
                            <span className="font-medium truncate">{fields?.title || "Untitled"}</span>
                            {closure?.compliance_estimate != null && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {Math.round(closure.compliance_estimate * 100)}% check-ins logged
                                {closure.days_active ? ` · ${closure.days_active} days` : ""}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="shrink-0 ml-2">
                            {a.status === "completed" ? "Completed" :
                             a.status === "incomplete" ? "Incomplete" : "Lapsed"}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
