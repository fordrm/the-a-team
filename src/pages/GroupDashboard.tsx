import { useEffect, useState } from "react";
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
import { Users, UserPlus, Heart, LogOut, Clock, AlertTriangle, Activity, Bell, Pencil, Trash2, Mail, User } from "lucide-react";
import { getRoleLabel } from "@/lib/roleLabels";
import { checkPermission } from "@/lib/checkPermission";
import Timeline from "@/components/timeline/Timeline";
import AddNote from "@/components/timeline/AddNote";
import AgreementsList from "@/components/agreements/AgreementsList";
import CreateAgreement from "@/components/agreements/CreateAgreement";
import AgreementDetail from "@/components/agreements/AgreementDetail";
import AgreementReview from "@/components/agreements/AgreementReview";
import ContradictionsList from "@/components/contradictions/ContradictionsList";
import CreateContradiction from "@/components/contradictions/CreateContradiction";
import ContradictionDetail from "@/components/contradictions/ContradictionDetail";
import InterventionsList from "@/components/interventions/InterventionsList";
import CreateIntervention from "@/components/interventions/CreateIntervention";
import InterventionDetail from "@/components/interventions/InterventionDetail";
import AlertsList from "@/components/alerts/AlertsList";
import AlertDetail from "@/components/alerts/AlertDetail";
import IndicatorTrend from "@/components/dashboard/IndicatorTrend";
import TrackingCyclesList from "@/components/cycles/TrackingCyclesList";
import CycleBanner from "@/components/cycles/CycleBanner";
import { CalendarRange } from "lucide-react";
import FocusedPeriodBanner from "@/components/focused-periods/FocusedPeriodBanner";
import ProposeFocusedPeriod from "@/components/focused-periods/ProposeFocusedPeriod";

interface GroupRow { id: string; name: string; }
interface MemberRow { id: string; user_id: string; role: string; display_name: string | null; is_active: boolean; }
interface PersonRow { id: string; label: string; is_primary: boolean; user_id: string | null; }

type AgreementView = { type: "list" } | { type: "create"; prefillFields?: import("@/types/agreements").VersionFields | null } | { type: "detail"; agreementId: string } | { type: "review"; agreementId: string };
type TimelineView = { type: "list" } | { type: "add" };
type ContradictionView = { type: "list" } | { type: "create" } | { type: "detail"; id: string };
type InterventionView = { type: "list" } | { type: "create" } | { type: "detail"; id: string };
type AlertView = { type: "list" } | { type: "detail"; id: string };

const PERSON_KEY = (gid: string) => `activePerson_${gid}`;
const TIMELINE_SEEN_KEY = (gid: string, pid: string) => `timelineSeen_${gid}_${pid}`;

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
  const [focusedPeriodKey, setFocusedPeriodKey] = useState(0);
  const [timelineUnread, setTimelineUnread] = useState(0);

  // invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("supporter");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  // person form
  const [personLabel, setPersonLabel] = useState("");
  const [personOpen, setPersonOpen] = useState(false);
  const [creatingPerson, setCreatingPerson] = useState(false);

  // portal invite
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

  // Persist active person in sessionStorage (M-2: prevent leaking on shared devices)
  const selectPerson = (id: string | null) => {
    setActivePersonId(id);
    if (groupId) {
      if (id) {
        try { sessionStorage.setItem(PERSON_KEY(groupId), id); } catch (_) {}
      } else {
        try { sessionStorage.removeItem(PERSON_KEY(groupId)); } catch (_) {}
      }
    }
  };

  const handleDeletePerson = async (personId: string) => {
    if (!groupId) return;
    setDeletingPersonId(personId);
    try {
      const perms = await checkPermission(user!.id, groupId!);
      if (!perms.isCoordinator) {
        toast({ title: "Permission denied", description: "Your access may have changed. Please refresh.", variant: "destructive" });
        setDeletingPersonId(null);
        return;
      }
      const { error } = await supabase.rpc("delete_supported_person", {
        p_group_id: groupId,
        p_person_id: personId,
      });
      if (error) throw error;
      toast({ title: "Person deleted", description: "Supported person and all related data removed." });
      if (activePersonId === personId) selectPerson(null);
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
    const fetchedPersons = pRes.data ?? [];
    setPersons(fetchedPersons);

    // Restore or validate persisted person selection
    if (groupId) {
      const stored = sessionStorage.getItem(PERSON_KEY(groupId));
      if (stored && fetchedPersons.some(p => p.id === stored)) {
        setActivePersonId(stored);
      } else if (fetchedPersons.length === 1) {
        // Auto-select if only one person
        setActivePersonId(fetchedPersons[0].id);
        try { sessionStorage.setItem(PERSON_KEY(groupId), fetchedPersons[0].id); } catch (_) {}
      } else {
        setActivePersonId(null);
        try { sessionStorage.removeItem(PERSON_KEY(groupId)); } catch (_) {}
      }
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [groupId]);

  // Count unread timeline items for badge
  useEffect(() => {
    if (!groupId || !activePersonId) {
      setTimelineUnread(0);
      return;
    }
    const seenKey = TIMELINE_SEEN_KEY(groupId, activePersonId);
    const lastSeen = sessionStorage.getItem(seenKey);
    if (!lastSeen) {
      setTimelineUnread(0);
      return;
    }
    const countNew = async () => {
      const { count, error } = await supabase
        .from("contact_notes")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId)
        .eq("subject_person_id", activePersonId)
        .gt("created_at", lastSeen);
      if (!error && count !== null) {
        setTimelineUnread(count);
      }
    };
    countNew();
  }, [groupId, activePersonId, timelineKey]);

  // Mark timeline as seen when user views it
  useEffect(() => {
    if (activeTab === "timeline" && groupId && activePersonId) {
      const seenKey = TIMELINE_SEEN_KEY(groupId, activePersonId);
      sessionStorage.setItem(seenKey, new Date().toISOString());
      setTimelineUnread(0);
    }
  }, [activeTab, groupId, activePersonId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;
    setInviting(true);
    try {
      const perms = await checkPermission(user!.id, groupId!);
      if (!perms.isCoordinator) {
        toast({ title: "Permission denied", description: "Your access may have changed. Please refresh.", variant: "destructive" });
        setInviting(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("invite-to-group", {
        body: { group_id: groupId, email: inviteEmail, role: inviteRole },
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
      const perms = await checkPermission(user!.id, groupId!);
      if (!perms.isMember) {
        toast({ title: "Permission denied", description: "Your access may have changed. Please refresh.", variant: "destructive" });
        setCreatingPerson(false);
        return;
      }
      const { data, error } = await supabase.from("persons").insert({
        group_id: groupId, label: personLabel, user_id: null, is_primary: true,
      }).select("id").single();
      if (error) throw error;
      toast({ title: "Person created" });
      setPersonOpen(false);
      setPersonLabel("");
      fetchData();
      // Auto-select the newly created person
      if (data?.id) {
        selectPerson(data.id);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setCreatingPerson(false); }
  };

  const handlePortalInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !portalInvitePersonId) return;
    setSendingPortalInvite(true);
    try {
      const perms = await checkPermission(user!.id, groupId!);
      if (!perms.isCoordinator) {
        toast({ title: "Permission denied", description: "Your access may have changed. Please refresh.", variant: "destructive" });
        setSendingPortalInvite(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("invite-supported-person", {
        body: { groupId, personId: portalInvitePersonId, email: portalInviteEmail },
      });
      if (error) {
        const errMsg = typeof error === "object" && error.message ? error.message : String(error);
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
      toast({ title: "Invite failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally { setSendingPortalInvite(false); }
  };

  // Derived
  const isSubjectPerson = activePersonId ? persons.find(p => p.id === activePersonId)?.user_id === user?.id : false;
  const isCoordinator = members.some(m => m.user_id === user?.id && m.role === "coordinator");
  const isMember = members.some(m => m.user_id === user?.id);
  const activePersonLabel = persons.find(p => p.id === activePersonId)?.label;

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading…</p></div>;

  const memberDisplayName = (m: MemberRow) => {
    if (m.display_name) return m.display_name;
    if (m.user_id === user?.id) return "You";
    return `Unnamed · ${m.user_id.slice(0, 6)}`;
  };

  // Tabs that need a person selected
  const personRequiredTabs = ["agreements", "timeline", "contradictions", "interventions", "alerts", "cycles"];
  const needsPersonSelector = !isSubjectPerson && personRequiredTabs.includes(activeTab);

  return (
    <div className="min-h-screen px-3 sm:px-6 py-4 sm:py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{group?.name}</h1>
            <p className="text-sm text-muted-foreground">Group Dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            {isCoordinator && groupId && (
              <ProposeFocusedPeriod groupId={groupId} onCreated={() => setFocusedPeriodKey(k => k + 1)} />
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>

        {/* Active Person Selector — shown above tabs when relevant */}
        {!isSubjectPerson && persons.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground shrink-0">Viewing:</span>
            </div>
            <Select value={activePersonId ?? ""} onValueChange={(val) => selectPerson(val || null)}>
              <SelectTrigger className="h-9 sm:h-8 flex-1">
                <SelectValue placeholder="Choose a supported person" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {persons.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* No persons CTA */}
        {!isSubjectPerson && persons.length === 0 && personRequiredTabs.includes(activeTab) && (
          <Card>
            <CardContent className="py-6 text-center space-y-3">
              <p className="text-sm font-medium">No supported persons yet</p>
              <p className="text-sm text-muted-foreground">Add a supported person first to begin coordinating care.</p>
              {isCoordinator && (
                <Button size="sm" variant="outline" onClick={() => { setActiveTab("persons"); setPersonOpen(true); }}>
                  + Add Supported Person
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Active Cycle Banner */}
        {activePersonId && !isSubjectPerson && (
          <CycleBanner groupId={groupId!} personId={activePersonId} />
        )}

        {/* Focused Period Banner */}
        {groupId && (
          <FocusedPeriodBanner key={focusedPeriodKey} groupId={groupId} variant="coordinator" />
        )}

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
                <SelectItem value="agreements"><span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Our Plan</span></SelectItem>
                <SelectItem value="timeline"><span className="flex items-center gap-2"><Clock className="h-4 w-4" /> {isSubjectPerson ? "Shared Notes" : "Timeline"}{timelineUnread > 0 && <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{timelineUnread > 99 ? "99+" : timelineUnread}</Badge>}</span></SelectItem>
                {!isSubjectPerson && <SelectItem value="contradictions"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Conflicts</span></SelectItem>}
                {!isSubjectPerson && <SelectItem value="interventions"><span className="flex items-center gap-2"><Activity className="h-4 w-4" /> Interventions</span></SelectItem>}
                {!isSubjectPerson && <SelectItem value="alerts"><span className="flex items-center gap-2"><Bell className="h-4 w-4" /> Alerts</span></SelectItem>}
                {!isSubjectPerson && <SelectItem value="cycles"><span className="flex items-center gap-2"><CalendarRange className="h-4 w-4" /> Cycles</span></SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {/* Desktop: tabs */}
          <TabsList className="hidden sm:flex w-full">
            {!isSubjectPerson && <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>}
            {!isSubjectPerson && <TabsTrigger value="persons" className="flex-1">Persons</TabsTrigger>}
            <TabsTrigger value="agreements" className="flex-1">Our Plan</TabsTrigger>
            <TabsTrigger value="timeline" className="flex-1"><span className="flex items-center gap-1">{isSubjectPerson ? "Shared Notes" : "Timeline"}{timelineUnread > 0 && <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{timelineUnread > 99 ? "99+" : timelineUnread}</Badge>}</span></TabsTrigger>
            {!isSubjectPerson && <TabsTrigger value="contradictions" className="flex-1">Conflicts</TabsTrigger>}
            {!isSubjectPerson && <TabsTrigger value="interventions" className="flex-1">Interventions</TabsTrigger>}
            {!isSubjectPerson && <TabsTrigger value="alerts" className="flex-1">Alerts</TabsTrigger>}
            {!isSubjectPerson && <TabsTrigger value="cycles" className="flex-1">Cycles</TabsTrigger>}
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
                            <SelectItem value="coordinator">Care Organizer</SelectItem>
                            <SelectItem value="supporter">Support Team</SelectItem>
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
                      const isSelf = m.user_id === user?.id;
                      const canEdit = isSelf || isCoordinator;
                      return (
                        <li key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{memberDisplayName(m)}</span>
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
                          <Badge variant="secondary" className="text-xs">{getRoleLabel(m.role)}</Badge>
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
                    <Input value={editNameValue} onChange={e => setEditNameValue(e.target.value)} placeholder="Set your display name" />
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
                {isCoordinator && (
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
                )}
              </CardHeader>
              <CardContent>
                {persons.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm font-medium">No supported persons yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Add a supported person first to begin coordinating care.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {persons.map(p => (
                      <li
                        key={p.id}
                        onClick={() => selectPerson(p.id)}
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
                isGroupMember={isMember}
                onCreateNew={() => setAgreementView({ type: "create" })}
                onViewAgreement={(id) => setAgreementView({ type: "detail", agreementId: id })}
              />
            )}
            {agreementView.type === "create" && activePersonId && (
              <CreateAgreement
                groupId={groupId!}
                personId={activePersonId}
                prefillFields={agreementView.prefillFields || null}
                onBack={() => setAgreementView({ type: "list" })}
                onCreated={(id) => {
                  setAgreementView({ type: "detail", agreementId: id });
                }}
              />
            )}
            {agreementView.type === "review" && (
              <AgreementReview
                agreementId={agreementView.agreementId}
                groupId={groupId!}
                onBack={() => setAgreementView({ type: "list" })}
                onRenew={(fields) => {
                  setAgreementView({ type: "create", prefillFields: fields });
                }}
              />
            )}
            {agreementView.type === "detail" && (
              <AgreementDetail
                agreementId={agreementView.agreementId}
                groupId={groupId!}
                onBack={() => setAgreementView({ type: "list" })}
                onStartReview={(id) => {
                  setAgreementView({ type: "review", agreementId: id });
                }}
              />
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            {timelineView.type === "list" && (
              <div className="space-y-4">
                <IndicatorTrend groupId={groupId!} personId={activePersonId} />
                <Timeline
                  key={timelineKey}
                  groupId={groupId!}
                  personId={activePersonId}
                  members={members}
                  isGroupMember={isMember}
                  onAddNote={() => setTimelineView({ type: "add" })}
                  lastSeenAt={
                    groupId && activePersonId
                      ? sessionStorage.getItem(TIMELINE_SEEN_KEY(groupId, activePersonId))
                      : null
                  }
                />
              </div>
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

          {/* Cycles Tab */}
          {!isSubjectPerson && (
            <TabsContent value="cycles">
              <TrackingCyclesList
                groupId={groupId!}
                personId={activePersonId}
                personLabel={activePersonLabel}
                isCoordinator={isCoordinator}
              />
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
