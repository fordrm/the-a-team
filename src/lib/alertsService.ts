import { supabase } from "@/integrations/supabase/client";

interface CreateAlertParams {
  group_id: string;
  subject_person_id: string;
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
  reason?: "duplicate_open" | "throttled_24h" | "invalid_params" | "unauthenticated" | "error";
  details?: string;
}

/**
 * Centralized alert creation with dedupe, throttling, and error safety.
 * Never throws. Never returns inserted:true on failure.
 * Derives actor from auth session internally.
 */
export async function createAlertIfNeeded(
  params: CreateAlertParams
): Promise<CreateAlertResult> {
  const { group_id, subject_person_id, type, severity, title, body, source_table, source_id } = params;

  // --- Strict param validation ---
  if (!group_id || !subject_person_id || !type || !severity || !title) {
    return { skipped: true, reason: "invalid_params", details: "missing required fields" };
  }
  if (source_table && !source_id) {
    return { skipped: true, reason: "invalid_params", details: "source_table requires source_id" };
  }

  // --- Derive actor from auth ---
  let actorUserId: string;
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return { skipped: true, reason: "unauthenticated" };
    }
    actorUserId = userData.user.id;
  } catch {
    return { skipped: true, reason: "unauthenticated", details: "auth check failed" };
  }

  // --- Dedupe: open/acknowledged with same key ---
  try {
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

    const { data: dupes, error: dedupeErr } = await dedupeQuery;
    if (dedupeErr) {
      return { skipped: true, reason: "error", details: `dedupe query: ${dedupeErr.message}` };
    }
    if (dupes && dupes.length > 0) {
      return { skipped: true, reason: "duplicate_open" };
    }
  } catch {
    return { skipped: true, reason: "error", details: "dedupe query exception" };
  }

  // --- Throttle: same key in last 24h ---
  try {
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

    const { data: recent, error: throttleErr } = await throttleQuery;
    if (throttleErr) {
      return { skipped: true, reason: "error", details: `throttle query: ${throttleErr.message}` };
    }
    if (recent && recent.length > 0) {
      return { skipped: true, reason: "throttled_24h" };
    }
  } catch {
    return { skipped: true, reason: "error", details: "throttle query exception" };
  }

  // --- Insert ---
  try {
    const { error: insErr } = await supabase.from("alerts").insert({
      group_id,
      subject_person_id,
      created_by_user_id: actorUserId,
      type,
      severity,
      title,
      body: body || null,
      source_table: source_table || null,
      source_id: source_id || null,
    });
    if (insErr) {
      return { skipped: true, reason: "error", details: `insert failed: ${insErr.message}` };
    }
    return { inserted: true };
  } catch {
    return { skipped: true, reason: "error", details: "insert exception" };
  }
}

/**
 * If any contradiction for the given person is open and older than 24h,
 * ensure a pattern_signal alert exists (deduped). Best-effort, never throws.
 */
export async function ensureUnresolvedContradictionAlert(
  groupId: string,
  subjectPersonId: string
): Promise<void> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: oldOpen, error } = await supabase
      .from("contradictions")
      .select("id")
      .eq("group_id", groupId)
      .eq("subject_person_id", subjectPersonId)
      .eq("status", "open")
      .lt("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error || !oldOpen || oldOpen.length === 0) return;

    await createAlertIfNeeded({
      group_id: groupId,
      subject_person_id: subjectPersonId,
      type: "pattern_signal",
      severity: "tier2",
      title: "Open contradiction unresolved > 24h",
      body: "At least one contradiction has been open for more than 24 hours. Review and resolve or dismiss.",
      source_table: "contradictions",
      source_id: oldOpen[0].id,
    });
  } catch {
    // best-effort: swallow
  }
}
