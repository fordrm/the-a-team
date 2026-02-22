import { supabase } from "@/integrations/supabase/client";

interface CreateAlertParams {
  group_id: string;
  subject_person_id: string;
  created_by_user_id: string;
  type: string;
  severity: string;
  title: string;
  body?: string | null;
  source_table?: string | null;
  source_id?: string | null;
}

interface CreateAlertResult {
  inserted?: boolean;
  skipped?: boolean;
  reason?: "duplicate_open" | "throttled_24h";
}

/**
 * Centralized alert creation with dedupe and throttling.
 *
 * 1. Checks for existing open/acknowledged alert with same key fields → skip if found.
 * 2. Checks for any alert (any status) with same key fields created in last 24h → skip if found.
 * 3. Otherwise inserts.
 */
export async function createAlertIfNeeded(
  params: CreateAlertParams
): Promise<CreateAlertResult> {
  const {
    group_id,
    subject_person_id,
    created_by_user_id,
    type,
    severity,
    title,
    body,
    source_table,
    source_id,
  } = params;

  if (!group_id || !subject_person_id || !type || !severity || !title) {
    return { skipped: true, reason: "duplicate_open" };
  }

  // --- Dedupe: check for open/acknowledged alert with same key ---
  let dedupeQuery = supabase
    .from("alerts")
    .select("id")
    .eq("group_id", group_id)
    .eq("subject_person_id", subject_person_id)
    .eq("type", type)
    .in("status", ["open", "acknowledged"])
    .limit(1);

  if (source_table) {
    dedupeQuery = dedupeQuery.eq("source_table", source_table);
  } else {
    dedupeQuery = dedupeQuery.is("source_table", null);
  }
  if (source_id) {
    dedupeQuery = dedupeQuery.eq("source_id", source_id);
  } else {
    dedupeQuery = dedupeQuery.is("source_id", null);
  }

  const { data: dupes } = await dedupeQuery;
  if (dupes && dupes.length > 0) {
    return { skipped: true, reason: "duplicate_open" };
  }

  // --- Throttle: any alert with same key in last 24h ---
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let throttleQuery = supabase
    .from("alerts")
    .select("id")
    .eq("group_id", group_id)
    .eq("subject_person_id", subject_person_id)
    .eq("type", type)
    .gte("created_at", twentyFourHoursAgo)
    .limit(1);

  if (source_table) {
    throttleQuery = throttleQuery.eq("source_table", source_table);
  } else {
    throttleQuery = throttleQuery.is("source_table", null);
  }
  if (source_id) {
    throttleQuery = throttleQuery.eq("source_id", source_id);
  } else {
    throttleQuery = throttleQuery.is("source_id", null);
  }

  const { data: recent } = await throttleQuery;
  if (recent && recent.length > 0) {
    return { skipped: true, reason: "throttled_24h" };
  }

  // --- Insert ---
  await supabase.from("alerts").insert({
    group_id,
    subject_person_id,
    created_by_user_id,
    type,
    severity,
    title,
    body: body || null,
    source_table: source_table || null,
    source_id: source_id || null,
  });

  return { inserted: true };
}

/**
 * If any contradiction for the given person is open and older than 24h,
 * ensure a pattern_signal alert exists (deduped).
 */
export async function ensureUnresolvedContradictionAlert(
  groupId: string,
  subjectPersonId: string,
  userId: string
): Promise<void> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: oldOpen } = await supabase
    .from("contradictions")
    .select("id")
    .eq("group_id", groupId)
    .eq("subject_person_id", subjectPersonId)
    .eq("status", "open")
    .lt("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: true })
    .limit(1);

  if (!oldOpen || oldOpen.length === 0) return;

  await createAlertIfNeeded({
    group_id: groupId,
    subject_person_id: subjectPersonId,
    created_by_user_id: userId,
    type: "pattern_signal",
    severity: "tier2",
    title: "Open contradiction unresolved > 24h",
    body: "At least one contradiction has been open for more than 24 hours. Review and resolve or dismiss.",
    source_table: "contradictions",
    source_id: oldOpen[0].id,
  });
}
