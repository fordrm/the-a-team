import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface AccessRequest {
  id: string;
  person_label: string;
  requester_user_id: string;
  status: string;
  created_at: string;
}

export default function RequestAccess() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [personLabel, setPersonLabel] = useState("");
  const [subjectEmail, setSubjectEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const fetchRequests = async () => {
    if (!groupId) return;
    const { data } = await supabase
      .from("person_access_requests")
      .select("id, person_label, requester_user_id, status, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
  };

  useEffect(() => {
    if (!groupId || !user) return;
    // Check if coordinator
    supabase
      .from("group_memberships")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()
      .then(({ data }) => {
        setIsCoordinator(data?.role === "coordinator");
      });
    fetchRequests();
  }, [groupId, user]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("person_access_requests").insert({
        group_id: groupId,
        person_label: personLabel.trim(),
        requester_user_id: user.id,
      });
      if (error) throw error;
      toast({ title: "Access request submitted" });
      setPersonLabel("");
      setSubjectEmail("");
      fetchRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    // For now, the coordinator needs to provide the subject user's UUID
    // In a real flow, we'd look up by email. For MVP, prompt for UUID.
    const subjectUserId = prompt("Enter the supported person's User ID (UUID):");
    if (!subjectUserId || !groupId) return;

    setApproving(requestId);
    try {
      const { data, error } = await supabase.rpc("approve_supported_person", {
        p_group_id: groupId,
        p_request_id: requestId,
        p_subject_user_id: subjectUserId,
      });
      if (error) throw error;
      toast({ title: "Approved", description: `Person created with ID: ${data}` });
      fetchRequests();
    } catch (err: any) {
      toast({ title: "Error approving", description: err.message, variant: "destructive" });
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!groupId) return;
    try {
      const { error } = await supabase
        .from("person_access_requests")
        .update({ status: "rejected", reviewed_by_user_id: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", requestId)
        .eq("group_id", groupId);
      if (error) throw error;
      toast({ title: "Request rejected" });
      fetchRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Supported Person Access</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/group/${groupId}`)}>
            ← Back
          </Button>
        </div>

        {/* Submit Request Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Request Supported Person Access</CardTitle>
            <CardDescription>
              Submit a request to link a supported person to this group.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="space-y-2">
                <Label>Person Label (name/alias)</Label>
                <Input
                  required
                  value={personLabel}
                  onChange={(e) => setPersonLabel(e.target.value)}
                  placeholder="e.g. Mom, Dad, Alex"
                />
              </div>
              <div className="space-y-2">
                <Label>Supported Person's Email (for reference)</Label>
                <Input
                  type="email"
                  value={subjectEmail}
                  onChange={(e) => setSubjectEmail(e.target.value)}
                  placeholder="person@example.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Request"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Pending Requests (coordinator view) */}
        {isCoordinator && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {requests.filter((r) => r.status === "pending").length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              ) : (
                <ul className="space-y-3">
                  {requests
                    .filter((r) => r.status === "pending")
                    .map((r) => (
                      <li key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{r.person_label}</p>
                          <p className="text-xs text-muted-foreground">
                            Requested by: {r.requester_user_id.slice(0, 8)}…
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(r.id)}
                            disabled={approving === r.id}
                          >
                            {approving === r.id ? "…" : "Approve"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(r.id)}>
                            Reject
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* All Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            ) : (
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{r.person_label}</span>
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
