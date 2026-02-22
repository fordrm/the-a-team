import { supabase } from "@/integrations/supabase/client";
import type { NavigateFunction } from "react-router-dom";

const LOCAL_STORAGE_KEYS = [
  "activeGroupId",
  "selectedGroupId",
  "activePersonId",
  "selectedPersonId",
  "groupContext",
];

export async function signOutAndReset(navigate: NavigateFunction) {
  try {
    await supabase.auth.signOut();
  } catch (_) {
    // best-effort
  }

  // Clear app-local context
  for (const key of LOCAL_STORAGE_KEYS) {
    try { localStorage.removeItem(key); } catch (_) {}
    try { sessionStorage.removeItem(key); } catch (_) {}
  }

  navigate("/auth", { replace: true });
  setTimeout(() => window.location.reload(), 50);
}
