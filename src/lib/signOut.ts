import { supabase } from "@/integrations/supabase/client";

export async function signOutAndReset() {
  await supabase.auth.signOut();
}
