import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AwaitingApproval() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(Date.now());
  const [checking, setChecking] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const POLL_INTERVAL = 5000;
  const POLL_TIMEOUT = 2 * 60 * 1000; // 2 minutes

  const checkApproval = async () => {
    if (!user) return;
    setChecking(true);
    try {
      // Check persons (supported person link)
      const { data: personData } = await supabase
        .from("persons")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (personData && personData.length > 0) {
        stopPolling();
        toast({ title: "You're linked — welcome." });
        navigate("/person-portal", { replace: true });
        return;
      }

      // Check group memberships
      const { data: memberData } = await supabase
        .from("group_memberships")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);

      if (memberData && memberData.length > 0) {
        stopPolling();
        toast({ title: "Access granted — welcome." });
        navigate(`/group/${memberData[0].group_id}`, { replace: true });
        return;
      }

      // Check timeout
      if (Date.now() - startRef.current > POLL_TIMEOUT) {
        stopPolling();
        setTimedOut(true);
      }
    } finally {
      setChecking(false);
    }
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    startRef.current = Date.now();
    setTimedOut(false);
    checkApproval();
    intervalRef.current = setInterval(checkApproval, POLL_INTERVAL);
  };

  useEffect(() => {
    if (!user) return;
    startPolling();
    return () => stopPolling();
  }, [user]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading…</p></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Almost there</CardTitle>
          <CardDescription>
            Your account is verified. Your care organizer still needs to link you to your support team. This page will update automatically.
          </CardDescription>
          {timedOut && (
            <p className="text-xs text-muted-foreground mt-2">
              Polling stopped after 2 minutes. Click "Try again" to resume checking.
            </p>
          )}
          {!timedOut && (
            <p className="text-xs text-muted-foreground mt-2">Checking every few seconds…</p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          {timedOut ? (
            <Button variant="outline" size="sm" onClick={startPolling}>
              <RefreshCw className="mr-1 h-4 w-4" /> Try again
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={checkApproval} disabled={checking}>
              <RefreshCw className={`mr-1 h-4 w-4 ${checking ? "animate-spin" : ""}`} /> Refresh Access
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1 h-4 w-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
