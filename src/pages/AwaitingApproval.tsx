import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { signOutAndReset } from "@/lib/signOut";

export default function AwaitingApproval() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [checking, setChecking] = useState(false);

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
        if (intervalRef.current) clearInterval(intervalRef.current);
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
        if (intervalRef.current) clearInterval(intervalRef.current);
        navigate(`/group/${memberData[0].group_id}`, { replace: true });
        return;
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    checkApproval();
    intervalRef.current = setInterval(checkApproval, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, navigate]);

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
          <CardTitle className="text-xl">Awaiting Coordinator Link</CardTitle>
          <CardDescription>
            Your account is set up. A coordinator needs to link you to a group or invite you as a supported person. This page checks automatically every few seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button variant="outline" size="sm" onClick={checkApproval} disabled={checking}>
            <RefreshCw className={`mr-1 h-4 w-4 ${checking ? "animate-spin" : ""}`} /> Refresh Access
          </Button>
          <Button variant="ghost" size="sm" onClick={() => signOutAndReset()}>
            <LogOut className="mr-1 h-4 w-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
