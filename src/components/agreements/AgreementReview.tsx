import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, AlertTriangle, Circle, RefreshCw } from "lucide-react";
import {
  formatCadenceDisplay,
  formatDurationDisplay,
  type VersionFields,
  type ClosureData,
  type ClosureStatus,
  type PersonAssessment,
  PERSON_ASSESSMENT_OPTIONS,
} from "@/types/agreements";

interface Props {
  agreementId: string;
  groupId: string;
  onBack: () => void;
  onRenew: (prefillFields: VersionFields) => void;
}

export default function AgreementReview({ agreementId, groupId, onBack, onRenew }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [agreement, setAgreement] = useState<any>(null);
  const [latestFields, setLatestFields] = useState<VersionFields | null>(null);
  const [personAssessment, setPersonAssessment] = useState<PersonAssessment | null>(null);
  const [personAssessmentMessage, setPersonAssessmentMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  // Review form state
  const [selectedOutcome, setSelectedOutcome] = useState<ClosureStatus | "renew" | null>(null);
  const [reflection, setReflection] = useState("");
  const [complianceEstimate, setComplianceEstimate] = useState<number | null>(null);

  useEffect(() => {
    fetchReviewData();
  }, [agreementId]);

  async function fetchReviewData() {
    setLoading(true);
    try {
      const { data: agData } = await supabase
        .from("agreements")
        .select("*")
        .eq("id", agreementId)
        .single();

      if (!agData) throw new Error("Agreement not found");
      setAgreement(agData);

      const { data: versionData } = await supabase
        .from("agreement_versions")
        .select("fields")
        .eq("agreement_id", agreementId)
        .order("version_num", { ascending: false })
        .limit(1);

      if (versionData?.[0]) {
        setLatestFields(versionData[0].fields as VersionFields);
      }

      // Fetch person self-assessment if any
      const { data: assessmentData } = await supabase
        .from("agreement_acceptances")
        .select("status, message")
        .eq("agreement_id", agreementId)
        .eq("status", "self_assessed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (assessmentData?.[0]) {
        setPersonAssessment(assessmentData[0].message as PersonAssessment);
        setPersonAssessmentMessage("");
      }

      // Estimate compliance from contact notes
      const startDate = agData.created_at;
      const endDate = new Date().toISOString();
      const fields = versionData?.[0]?.fields as VersionFields;

      if (fields?.cadence && typeof fields.cadence === "object") {
        const { count } = await supabase
          .from("contact_notes")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("subject_person_id", agData.subject_person_id)
          .gte("created_at", startDate)
          .lte("created_at", endDate);

        const daysDiff = Math.max(1, Math.floor(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
        ));

        let expectedCount = daysDiff;
        if (fields.cadence.frequency === "weekly") expectedCount = Math.ceil(daysDiff / 7);
        else if (fields.cadence.frequency === "biweekly") expectedCount = Math.ceil(daysDiff / 14);
        else if (fields.cadence.frequency === "monthly") expectedCount = Math.ceil(daysDiff / 30);

        const actualCount = count || 0;
        const estimate = Math.min(1, expectedCount > 0 ? actualCount / expectedCount : 0);
        setComplianceEstimate(Math.round(estimate * 100) / 100);
      }
    } catch (err) {
      console.error("Failed to load review data:", err);
      toast({ title: "Error", description: "Failed to load review data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleClose() {
    if (!selectedOutcome || !user || !agreement) return;

    const closureStatus: ClosureStatus = selectedOutcome === "renew" ? "completed" : selectedOutcome;
    const isEarlyClose = agreement.status === "accepted";

    const startDate = new Date(agreement.created_at);
    const now = new Date();
    const daysActive = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysPlanned = latestFields?.duration?.type === "fixed" ? (latestFields.duration.days || 0) : undefined;

    const closureData: ClosureData = {
      status: closureStatus,
      closed_by: user.id,
      closed_at: now.toISOString(),
      compliance_estimate: complianceEstimate ?? undefined,
      person_assessment: personAssessment ?? undefined,
      reflection: reflection || undefined,
      early_close: isEarlyClose && agreement.status !== "review_needed",
      days_active: daysActive,
      days_planned: daysPlanned,
    };

    setClosing(true);
    try {
      const { error } = await supabase
        .from("agreements")
        .update({
          status: closureStatus,
          closure: closureData as any,
        })
        .eq("id", agreementId);

      if (error) throw error;

      toast({
        title: closureStatus === "completed" ? "Commitment completed" :
               closureStatus === "incomplete" ? "Commitment marked incomplete" :
               "Commitment marked as lapsed",
        description: selectedOutcome === "renew" ? "Opening renewal form..." : "The agreement has been closed.",
      });

      if (selectedOutcome === "renew" && latestFields) {
        onRenew({ ...latestFields, renewed_from: agreementId });
      } else {
        onBack();
      }
    } catch (err) {
      console.error("Failed to close agreement:", err);
      toast({ title: "Error", description: "Failed to close agreement", variant: "destructive" });
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading review data…</p>;
  }

  if (!agreement || !latestFields) {
    return <p className="text-sm text-muted-foreground">Agreement not found.</p>;
  }

  const daysActive = Math.floor(
    (Date.now() - new Date(agreement.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysPlanned = latestFields.duration?.type === "fixed" ? (latestFields.duration.days || 0) : null;
  const compliancePercent = complianceEstimate ? Math.round(complianceEstimate * 100) : null;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to agreement
      </Button>

      {/* Review Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">
            Review: {latestFields.title || "Commitment"}
          </CardTitle>
          {agreement.status === "review_needed" && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              Review due
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Active for: </span>
              <span className="font-medium">{daysActive} days</span>
              {daysPlanned ? ` of ${daysPlanned} planned` : ""}
              {agreement.status === "accepted" && daysPlanned && daysActive < daysPlanned && (
                <span className="text-amber-600 ml-1">(closing early)</span>
              )}
            </p>
            <p>
              <span className="text-muted-foreground">Commitment: </span>
              <span className="italic">"{latestFields.i_will_statement || "—"}"</span>
            </p>
            <p>
              <span className="text-muted-foreground">Schedule: </span>
              {formatCadenceDisplay(latestFields)}
            </p>
            {latestFields.duration && (
              <p>
                <span className="text-muted-foreground">Duration: </span>
                {formatDurationDisplay(latestFields)}
              </p>
            )}
          </div>

          {/* Compliance estimate */}
          {compliancePercent !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Check-ins logged</span>
                <span className="font-medium">{compliancePercent}%</span>
              </div>
              <Progress value={compliancePercent} className="h-2.5 sm:h-2" />
              <p className="text-[10px] text-muted-foreground">
                Based on notes logged during the agreement period. This is a rough estimate, not a score.
              </p>
            </div>
          )}

          {/* Person self-assessment */}
          {personAssessment && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Their self-assessment:</p>
              <p className="text-sm font-medium">
                {PERSON_ASSESSMENT_OPTIONS.find(o => o.value === personAssessment)?.emoji}{" "}
                {PERSON_ASSESSMENT_OPTIONS.find(o => o.value === personAssessment)?.label}
              </p>
            </div>
          )}

          {!personAssessment && agreement.status === "review_needed" && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                No self-assessment submitted yet. You can still proceed with the review.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">What's the outcome?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant={selectedOutcome === "completed" ? "default" : "outline"}
              className="justify-start gap-2 h-auto py-3.5"
              onClick={() => setSelectedOutcome("completed")}
            >
              <CheckCircle className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Completed</p>
                <p className="text-xs text-muted-foreground font-normal">Commitment was met</p>
              </div>
            </Button>

            <Button
              variant={selectedOutcome === "incomplete" ? "default" : "outline"}
              className="justify-start gap-2 h-auto py-3.5"
              onClick={() => setSelectedOutcome("incomplete")}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Incomplete</p>
                <p className="text-xs text-muted-foreground font-normal">Attempted but not consistent</p>
              </div>
            </Button>

            <Button
              variant={selectedOutcome === "lapsed" ? "default" : "outline"}
              className="justify-start gap-2 h-auto py-3.5"
              onClick={() => setSelectedOutcome("lapsed")}
            >
              <Circle className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Lapsed</p>
                <p className="text-xs text-muted-foreground font-normal">Quietly dropped</p>
              </div>
            </Button>

            <Button
              variant={selectedOutcome === "renew" ? "default" : "outline"}
              className="justify-start gap-2 h-auto py-3.5"
              onClick={() => setSelectedOutcome("renew")}
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Renew / Revise</p>
                <p className="text-xs text-muted-foreground font-normal">Close this, start a new version</p>
              </div>
            </Button>
          </div>

          {selectedOutcome && (
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">
                {selectedOutcome === "lapsed"
                  ? "Any notes? (optional)"
                  : "What worked? What didn't? What did you learn?"}
              </label>
              <Textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder={
                  selectedOutcome === "completed"
                    ? "e.g., Became a solid habit after week one..."
                    : selectedOutcome === "incomplete"
                    ? "e.g., Worked at first but tapered off when..."
                    : selectedOutcome === "lapsed"
                    ? "e.g., Never really got started because..."
                    : "e.g., Extending duration and adjusting schedule..."
                }
                rows={3}
                className="text-base sm:text-sm"
              />
            </div>
          )}

          {selectedOutcome && (
            <Button
              onClick={handleClose}
              disabled={closing || (!reflection && selectedOutcome !== "lapsed")}
              className="w-full"
            >
              {closing
                ? "Closing..."
                : selectedOutcome === "renew"
                ? "Close & Open Renewal"
                : `Mark as ${selectedOutcome}`}
            </Button>
          )}

          {selectedOutcome && !reflection && selectedOutcome !== "lapsed" && (
            <p className="text-xs text-muted-foreground text-center">
              A brief reflection helps the team learn from this agreement.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
