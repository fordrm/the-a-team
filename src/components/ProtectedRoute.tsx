import { useEffect, useState, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type RequiredRole = "authenticated" | "coordinator" | "member" | "not-supported-person";

interface ProtectedRouteProps {
  children: ReactNode;
  require?: RequiredRole;
  groupId?: string;
}

type CheckResult = "loading" | "authorized" | "redirect-auth" | "redirect-portal" | "redirect-home";

export default function ProtectedRoute({ children, require = "authenticated", groupId }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const [checkResult, setCheckResult] = useState<CheckResult>("loading");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCheckResult("redirect-auth");
      return;
    }

    if (require === "authenticated") {
      setCheckResult("authorized");
      return;
    }

    const checkRole = async () => {
      const { data: personData } = await supabase
        .from("persons")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      const isSupportedPerson = (personData?.length ?? 0) > 0;

      if (require === "not-supported-person") {
        setCheckResult(isSupportedPerson ? "redirect-portal" : "authorized");
        return;
      }

      if (isSupportedPerson) {
        setCheckResult("redirect-portal");
        return;
      }

      if (require === "member") {
        const query = supabase
          .from("group_memberships")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1);

        if (groupId) query.eq("group_id", groupId);

        const { data: memberData } = await query;
        setCheckResult((memberData?.length ?? 0) > 0 ? "authorized" : "redirect-home");
        return;
      }

      if (require === "coordinator") {
        const { data: coordData } = await supabase
          .from("group_memberships")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "coordinator")
          .eq("is_active", true)
          .limit(1);

        setCheckResult((coordData?.length ?? 0) > 0 ? "authorized" : "redirect-home");
        return;
      }

      setCheckResult("authorized");
    };

    checkRole();
  }, [user, authLoading, require, groupId]);

  if (checkResult === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (checkResult === "redirect-auth") return <Navigate to="/auth" replace />;
  if (checkResult === "redirect-portal") return <Navigate to="/person-portal" replace />;
  if (checkResult === "redirect-home") return <Navigate to="/" replace />;

  return <>{children}</>;
}
