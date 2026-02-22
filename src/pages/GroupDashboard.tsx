import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Heart, LogOut, Clock, AlertTriangle, Activity, Bell, Pencil, Trash2, Mail } from "lucide-react";
import Timeline from "@/components/timeline/Timeline";
import AddNote from "@/components/timeline/AddNote";
import AgreementsList from "@/components/agreements/AgreementsList";
import CreateAgreement from "@/components/agreements/CreateAgreement";
import AgreementDetail from "@/components/agreements/AgreementDetail";
import ContradictionsList from "@/components/contradictions/ContradictionsList";
import CreateContradiction from "@/components/contradictions/CreateContradiction";
import ContradictionDetail from "@/components/contradictions/ContradictionDetail";
import InterventionsList from "@/components/interventions/InterventionsList";
import CreateIntervention from "@/components/interventions/CreateIntervention";
import InterventionDetail from "@/components/interventions/InterventionDetail";
import AlertsList from "@/components/alerts/AlertsList";
import AlertDetail from "@/components/alerts/AlertDetail";

interface GroupRow { id: string; name: string; }
interface MemberRow { id: string; user_id: string; role: string; display_name: string | null; is_active: boolean; }
interface PersonRow { id: string; label: string; is_primary: boolean; user_id: string | null; }

type AgreementView = { type: "list" } | { type: "create" } | { type: "detail"; agreementId: string };
type TimelineView = { type: "list" } | { type: "add" };
type ContradictionView = { type: "list" } | { type: "create" } | { type: "detail"; id: string };
type InterventionView = { type: "list" } | { type: "create" } | { type: "detail"; id: string };
type AlertView = { type: "list" } | { type: "detail"; id: string };

export default function GroupDashboard() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("members");
  const [agreementView, setAgreementView] = useState<AgreementView>({ type: "list" });
  const [timelineView, setTimelineView] = useState<TimelineView>({ type: "list" });
  const [timelineKey, setTimelineKey] = useState(0);
  const [contradictionView, setContradictionView] = useState<ContradictionView>({ type: "list" });
  const [contradictionKey, setContradictionKey] = useState(0);
  const [interventionView, setInterventionView] = useState<InterventionView>({ type: "list" });
  const [interventionKey, setInterventionKey] = useState(0);
  const [alertView, setAlertView] = useState<AlertView>({ type: "list" });
  const [alertKey, setAlertKey] = useState(0);

  // invite form (members only - coordinator/supporter)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("supporter");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  // person form
  const [personLabel, setPersonLabel] = useState("");
  const [personOpen, setPersonOpen] = useState(false);
  const [creatingPerson, setCreatingPerson] = useState(false);

  // invite supported person portal access
  const [portalInviteOpen, setPortalInviteOpen] = useState(false);
  const [portalInvitePersonId, setPortalInvitePersonId] = useState<string | null>(null);
  const [portalInviteEmail, setPortalInviteEmail] = useState("");
  const [sendingPortalInvite, setSendingPortalInvite] = useState(false);

  // edit display name
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editNameMemberId, setEditNameMemberId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null);

  const handleDeletePerson = async (personId: string) => {
    if (!groupId) return;
    setDeletingPersonId(personId);
    try {
      const { error } = await supabase.rpc("delete_supported_person", {
        p_group_id: groupId,
        p_person_id: personId,
      });
      if (error) throw error;
      toast({ title: "Person deleted", description: "Supported person and all related data removed." });
      if (activePersonId === personId) setActivePersonId(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingPersonId(null);
    }
  };

  const fetchData = async () => {
    if (!groupId) return;
    const [gRes, mRes, pRes] = await Promise.all([
      supabase.from("groups").select("id, name").eq("id", groupId).single(),
      supabase.from("group_memberships").select("id, user_id, role, display_name, is_active").eq("group_id", groupId).eq("is_active", true),
      supabase.from("persons").select("id, label, is_primary, user_id").eq("group_id", groupId),
    ]);
    if (gRes.error) {
      toast({ title: "Access denied", description: gRes.error.message, variant: "destructive" });
      navigate("/");
      return;
    }
    setGroup(gRes.data);
    setMembers(mRes.data ?? []);
    setPersons(pRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [groupId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-to-group", {
        body: {
          group_id: groupId,
          email: inviteEmail,
          role: inviteRole,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const msg = data?.existing_user
        ? `${inviteEmail} has been added to the group.`
        : `Invite sent to ${inviteEmail}. They must set a password from the email to join.`;
      toast({ title: "Invite sent", description: msg });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("supporter");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setInviting(false); }
  };

  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;
    setCreatingPerson(true);
    try {
      const { error } = await supabase.from("persons").insert({
        group_id: groupId, label: personLabel, user_id: null, is_primary: true,
      });
      if (error) throw error;
      toast({ title: "Person created" });
      setPersonOpen(false); setPersonLabel("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setCreatingPerson(false); }
  };

  const handlePortalInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !portalInvitePersonId) return;
    const DEBUG_INVITES = true;
    setSendingPortalInvite(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-supported-person", {
        body: {
          groupId,
          personId: portalInvitePersonId,
          email: portalInviteEmail,
        },
      });
      if (DEBUG_INVITES) {
        console.log("[invite-supported-person] response data=", data, "error=", error);
      }
      // Handle FunctionsHttpError / FunctionsRelayError / FunctionsFetchError
      if (error) {
        const errMsg = typeof error === "object" && error.message ? error.message : String(error);
        console.error("[invite-supported-person] invoke error:", error);
        // Try to extract body from the error context (data may contain the JSON)
        if (data?.error) {
          throw new Error(`${data.error}${data.step ? ` (step: ${data.step})` : ""}`);
        }
        throw new Error(errMsg);
      }
      if (data?.error) {
        throw new Error(`${data.error}${data.step ? ` (step: ${data.step})` : ""}`);
      }
      const msg = data?.existingUser
        ? `${portalInviteEmail} has been linked. They can sign in to access their portal.`
        : `Invite sent to ${portalInviteEmail}. Once they set a password and sign in, they'll see their portal.`;
      toast({ title: "Portal invite sent", description: msg });
      setPortalInviteOpen(false);
      setPortalInviteEmail("");
      setPortalInvitePersonId(null);
      fetchData();
    } catch (err: any) {
      console.error("[invite-supported-person] caught error:", err);
      toast({ title: "Invite failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally { setSendingPortalInvite(false); }
  };

  // Derived: is current user the supported person for active person? Is coordinator?
  const isSubjectPerson = activePersonId ? persons.find(p => p.id === activePersonId)?.user_id === user?.id : false;
  const isCoordinator = members.some(m => m.user_id === user?.id && m.role === "coordinator");

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading…</p></div>;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{group?.name}</h1>
            <p className="text-sm text-muted-foreground">Group Dashboard</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1 h-4 w-4" /> Sign Out
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Mobile: dropdown */}
          <div className="sm:hidden">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {!isSubjectPerson && <SelectItem value="members"><span className="flex items-center gap-2"><Users className="h-4 w-4" /> Members</span></SelectItem>}
                {!isSubjectPerson && <SelectItem value="persons"><span className="flex items-center gap-2"><Heart className="h-4 w-4" /> Persons</span></SelectItem>}
                <SelectItem value="agreements"><span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Agreements</span></SelectItem>
                <SelectItem value="timeline"><span className="flex items-center gap-2"><Clock className="h-4 w-4" /> {isSubjectPerson ? "Shared Notes" : "Timeline"}</span></SelectItem>
                {!isSubjectPerson && <SelectItem value="contradictions"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Conflicts</span></SelectItem>}
                {!isSubjectPerson && <SelectItem value="interventions"><span className="flex items-center gap-2"><Activity className="h-4 w-4" /> Interventions</span></SelectItem>}
                {!isSubjectPerson && <SelectItem value="alerts"><span className="flex items-center gap-2"><Bell className="h-4 w-4" /> Alerts</span></SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {/* Desktop: tabs */}
          <TabsList className="hidden sm:flex w-full">
            {!isSubjectPerson && <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>}
            {!isSubjectPerson && <TabsTrigger value="persons" className="flex-1">Persons</TabsTrigger>}
            <TabsTrigger value="agreements" className="flex-1">Agreements</TabsTrigger>
            <TabsTrigger value="timeline" className="flex-1">{isSubjectPerson ? "Shared Notes" : "Timeline"}</TabsTrigger>
            {!isSubjectPerson && <TabsTrigger value="contradictions" className="flex-1">Conflicts</TabsTrigger>}
            {!isSubjectPerson && <TabsTrigger value="interventions" className="flex-1">Interventions</TabsTrigger>}
            {!isSubjectPerson && <TabsTrigger value="alerts" className="flex-1">Alerts</TabsTrigger>}
          </TabsList>

          {/* Members Tab */}
          {!isSubjectPerson && (
          <TabsContent value="members">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" /> Members
                </CardTitle>
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><UserPlus className="mr-1 h-4 w-4" /> Invite</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
                    <form onSubmit={handleInvite} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input required type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@example.com" />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="coordinator">Coordinator</SelectItem>
                            <SelectItem value="supporter">Supporter</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full" disabled={inviting}>{inviting ? "Sending…" : "Send Invite"}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {members.map(m => {
                      const displayName = m.display_name || `Member (${m.user_id.slice(-6)})`;
                      const isSelf = m.user_id === user?.id;
                      const canEdit = isSelf || (isCoordinator && !m.display_name);
                      return (
                        <li key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{displayName}</span>
                            {canEdit && (
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-primary"
                                onClick={() => { setEditNameMemberId(m.id); setEditNameValue(m.display_name || ""); setEditNameOpen(true); }}
                                title={isSelf ? "Edit my name" : "Set name"}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <span className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground">{m.role}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Edit Display Name Dialog */}
            <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Display Name</DialogTitle></DialogHeader>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editNameMemberId) return;
                  setSavingName(true);
                  try {
                    const { error } = await supabase
                      .from("group_memberships")
                      .update({ display_name: editNameValue.trim() || null })
                      .eq("id", editNameMemberId);
                    if (error) throw error;
                    toast({ title: "Name updated" });
                    setEditNameOpen(false);
                    fetchData();
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  } finally { setSavingName(false); }
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input value={editNameValue} onChange={e => setEditNameValue(e.target.value)} placeholder="Enter a display name" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setEditNameOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={savingName}>{savingName ? "Saving…" : "Save"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>
          )}

          {/* Persons Tab */}
          {!isSubjectPerson && (
          <TabsContent value="persons">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="h-5 w-5 text-primary" /> Supported Persons
                </CardTitle>
                <Dialog open={personOpen} onOpenChange={setPersonOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">+ Add Person</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Supported Person</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreatePerson} className="space-y-4">
                      <div className="space-y-2"><Label>Label (name)</Label><Input required value={personLabel} onChange={e => setPersonLabel(e.target.value)} placeholder="e.g. Mom" /></div>
                      <Button type="submit" className="w-full" disabled={creatingPerson}>{creatingPerson ? "Creating…" : "Create Person"}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {persons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No supported persons yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {persons.map(p => (
                      <li
                        key={p.id}
                        onClick={() => setActivePersonId(p.id)}
                        className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                          activePersonId === p.id ? "border-primary bg-accent" : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.label}</span>
                          {p.user_id ? (
                            <Badge variant="secondary" className="text-xs">Portal linked</Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {activePersonId === p.id && <span className="text-xs text-primary font-medium">Active</span>}
                          {/* Invite Portal Access button - only for coordinators, only if no user linked */}
                          {isCoordinator && !p.user_id && (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPortalInvitePersonId(p.id);
                                setPortalInviteEmail("");
                                setPortalInviteOpen(true);
                              }}
                              title="Invite portal access"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isCoordinator && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Delete person"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{p.label}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this supported person and all their related data (agreements, notes, interventions, contradictions, alerts, and consents). This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeletePerson(p.id)}
                                    disabled={deletingPersonId === p.id}
                                  >
                                    {deletingPersonId === p.id ? "Deleting…" : "Delete"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Portal Invite Dialog */}
            <Dialog open={portalInviteOpen} onOpenChange={setPortalInviteOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite Portal Access</DialogTitle></DialogHeader>
                <form onSubmit={handlePortalInvite} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Person</Label>
                    <Select value={portalInvitePersonId ?? ""} onValueChange={setPortalInvitePersonId}>
                      <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {persons.filter(p => !p.user_id).map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input required type="email" value={portalInviteEmail} onChange={e => setPortalInviteEmail(e.target.value)} placeholder="person@example.com" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The person will receive an email to set up their account. Once they sign in, they'll land in their portal automatically.
                  </p>
                  <Button type="submit" className="w-full" disabled={sendingPortalInvite || !portalInvitePersonId}>
                    {sendingPortalInvite ? "Sending…" : "Send Invite"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>
          )}

          {/* Agreements Tab */}
          <TabsContent value="agreements">
            {agreementView.type === "list" && (
              <AgreementsList
                groupId={groupId!}
                personId={activePersonId}
                onCreateNew={() => setAgreementView({ type: "create" })}
                onViewAgreement={(id) => setAgreementView({ type: "detail", agreementId: id })}
              />
            )}
            {agreementView.type === "create" && activePersonId && (
              <CreateAgreement
                groupId={groupId!}
                personId={activePersonId}
                onBack={() => setAgreementView({ type: "list" })}
                onCreated={() => setAgreementView({ type: "list" })}
              />
            )}
            {agreementView.type === "detail" && (
              <AgreementDetail
                agreementId={agreementView.agreementId}
                groupId={groupId!}
                onBack={() => setAgreementView({ type: "list" })}
              />
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            {timelineView.type === "list" && (
              <Timeline
                key={timelineKey}
                groupId={groupId!}
                personId={activePersonId}
                members={members}
                onAddNote={() => setTimelineView({ type: "add" })}
              />
            )}
            {timelineView.type === "add" && activePersonId && (
              <AddNote
                groupId={groupId!}
                personId={activePersonId}
                onBack={() => setTimelineView({ type: "list" })}
                onCreated={() => { setTimelineView({ type: "list" }); setTimelineKey(k => k + 1); }}
              />
            )}
          </TabsContent>

          {/* Contradictions Tab */}
          {!isSubjectPerson && (
            <TabsContent value="contradictions">
              {contradictionView.type === "list" && (
                <ContradictionsList
                  key={contradictionKey}
                  groupId={groupId!}
                  personId={activePersonId}
                  onCreateNew={() => setContradictionView({ type: "create" })}
                  onView={(id) => setContradictionView({ type: "detail", id })}
                />
              )}
              {contradictionView.type === "create" && activePersonId && (
                <CreateContradiction
                  groupId={groupId!}
                  personId={activePersonId}
                  onBack={() => setContradictionView({ type: "list" })}
                  onCreated={() => { setContradictionView({ type: "list" }); setContradictionKey(k => k + 1); }}
                />
              )}
              {contradictionView.type === "detail" && (
                <ContradictionDetail
                  contradictionId={contradictionView.id}
                  groupId={groupId!}
                  isCoordinator={isCoordinator}
                  onBack={() => setContradictionView({ type: "list" })}
                />
              )}
            </TabsContent>
          )}

          {/* Interventions Tab */}
          {!isSubjectPerson && (
          <TabsContent value="interventions">
            {interventionView.type === "list" && (
              <InterventionsList
                key={interventionKey}
                groupId={groupId!}
                personId={activePersonId}
                onCreateNew={() => setInterventionView({ type: "create" })}
                onView={(id) => setInterventionView({ type: "detail", id })}
              />
            )}
            {interventionView.type === "create" && activePersonId && (
              <CreateIntervention
                groupId={groupId!}
                personId={activePersonId}
                onBack={() => setInterventionView({ type: "list" })}
                onCreated={() => { setInterventionView({ type: "list" }); setInterventionKey(k => k + 1); }}
              />
            )}
            {interventionView.type === "detail" && (
              <InterventionDetail
                interventionId={interventionView.id}
                groupId={groupId!}
                isCoordinator={isCoordinator}
                onBack={() => setInterventionView({ type: "list" })}
              />
            )}
          </TabsContent>
          )}

          {/* Alerts Tab */}
          {!isSubjectPerson && (
            <TabsContent value="alerts">
              {alertView.type === "list" && (
                <AlertsList
                  key={alertKey}
                  groupId={groupId!}
                  personId={activePersonId}
                  isCoordinator={isCoordinator}
                  onView={(id) => setAlertView({ type: "detail", id })}
                />
              )}
              {alertView.type === "detail" && (
                <AlertDetail
                  alertId={alertView.id}
                  groupId={groupId!}
                  isCoordinator={isCoordinator}
                  onBack={() => { setAlertView({ type: "list" }); setAlertKey(k => k + 1); }}
                  onNavigateSource={(table, id) => {
                    if (table === "contradictions") {
                      setContradictionView({ type: "detail", id });
                    } else if (table === "interventions") {
                      setInterventionView({ type: "detail", id });
                    } else if (table === "agreement_acceptances") {
                      // Navigate to agreements tab
                    }
                  }}
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
