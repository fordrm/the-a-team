import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://the-a-team.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  console.log("[invite-supported-person] method=%s url=%s hasAuth=%s",
    req.method, req.url, !!req.headers.get("Authorization"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    console.log("[invite-supported-person] env: url=%s hasServiceKey=%s hasAnonKey=%s",
      !!supabaseUrl, !!serviceRoleKey, !!anonKey);

    // --- Step: auth_check ---
    console.log("[invite-supported-person] step=auth_check");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Not authenticated", step: "auth_check" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error("[invite-supported-person] step=auth_check userError=", userError);
      return jsonResponse(req, { error: "Invalid token", step: "auth_check" }, 401);
    }
    const callerId = userData.user.id;
    console.log("[invite-supported-person] step=auth_check callerId=%s", callerId);

    // --- Parse body ---
    const body = await req.json();
    const { groupId, personId, email } = body;
    console.log("[invite-supported-person] body keys=%s groupId=%s personId=%s email=%s",
      Object.keys(body).join(","), groupId, personId, email);

    if (!groupId || !personId || !email) {
      return jsonResponse(req, { error: "groupId, personId, and email are required", step: "parse_body" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // --- Step: coordinator_check ---
    console.log("[invite-supported-person] step=coordinator_check");
    const { data: membership } = await adminClient
      .from("group_memberships")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", callerId)
      .eq("role", "coordinator")
      .eq("is_active", true)
      .maybeSingle();

    if (!membership) {
      return jsonResponse(req, { error: "Only coordinators can invite supported persons", step: "coordinator_check" }, 403);
    }

    // --- Step: verify_person ---
    console.log("[invite-supported-person] step=verify_person");
    const { data: person } = await adminClient
      .from("persons")
      .select("id, user_id")
      .eq("id", personId)
      .eq("group_id", groupId)
      .maybeSingle();

    if (!person) {
      return jsonResponse(req, { error: "Person not found in this group", step: "verify_person" }, 404);
    }

    if (person.user_id) {
      return jsonResponse(req, { error: "This person already has a linked user account", step: "verify_person" }, 400);
    }

    // --- Step: lookup_user ---
    console.log("[invite-supported-person] step=lookup_user");
    const normalizedEmail = email.trim().toLowerCase();
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    let invitedUserId: string;

    if (existingUser) {
      invitedUserId = existingUser.id;
      console.log("[invite-supported-person] step=lookup_user found existing user=%s", invitedUserId);
    } else {
      // --- Step: create_user ---
      console.log("[invite-supported-person] step=create_user");
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(normalizedEmail);
      if (inviteError) {
        console.error("[invite-supported-person] step=create_user error=", inviteError);
        return jsonResponse(req, { error: inviteError.message, step: "create_user" }, 400);
      }
      invitedUserId = inviteData.user.id;
      console.log("[invite-supported-person] step=create_user created user=%s", invitedUserId);
    }

    // --- Step: link_person ---
    console.log("[invite-supported-person] step=link_person");
    const { error: updateError } = await adminClient
      .from("persons")
      .update({ user_id: invitedUserId, is_primary: true })
      .eq("id", personId)
      .eq("group_id", groupId);

    if (updateError) {
      console.error("[invite-supported-person] step=link_person error=", updateError);
      return jsonResponse(req, { error: updateError.message, step: "link_person" }, 500);
    }

    // Create baseline consent if none exists
    const { data: existingConsent } = await adminClient
      .from("person_consents")
      .select("id")
      .eq("group_id", groupId)
      .eq("subject_person_id", personId)
      .maybeSingle();

    if (!existingConsent) {
      await adminClient.from("person_consents").insert({
        group_id: groupId,
        subject_person_id: personId,
        created_by_user_id: callerId,
        consent_scope: "shared_notes_and_agreements_only",
      });
    }

    // --- Step: success ---
    console.log("[invite-supported-person] step=success invitedUserId=%s personId=%s", invitedUserId, personId);
    return jsonResponse(req, {
      success: true,
      invitedUserId,
      personId,
      groupId,
      existingUser: !!existingUser,
    });
  } catch (err) {
    console.error("[invite-supported-person] step=edge_function unhandled error=", err);
    return jsonResponse(req, { error: err.message || "unknown", step: "edge_function" }, 500);
  }
});
