import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Auth: get caller from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;

    const body = await req.json();
    const { groupId, personId, email } = body;

    if (!groupId || !personId || !email) {
      return new Response(
        JSON.stringify({ error: "groupId, personId, and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is coordinator
    const { data: membership } = await adminClient
      .from("group_memberships")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", callerId)
      .eq("role", "coordinator")
      .eq("is_active", true)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Only coordinators can invite supported persons" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify person exists in this group
    const { data: person } = await adminClient
      .from("persons")
      .select("id, user_id")
      .eq("id", personId)
      .eq("group_id", groupId)
      .maybeSingle();

    if (!person) {
      return new Response(
        JSON.stringify({ error: "Person not found in this group" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (person.user_id) {
      return new Response(
        JSON.stringify({ error: "This person already has a linked user account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find or create auth user by email
    const normalizedEmail = email.trim().toLowerCase();
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    let invitedUserId: string;

    if (existingUser) {
      invitedUserId = existingUser.id;
    } else {
      // Invite user by email - sends them a setup email
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(normalizedEmail);
      if (inviteError) {
        return new Response(
          JSON.stringify({ error: inviteError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      invitedUserId = inviteData.user.id;
    }

    // Link the user to the person record using the RPC
    // We use the admin client to call the RPC impersonating the coordinator
    const { data: linkedPersonId, error: linkError } = await adminClient.rpc(
      "upsert_supported_person_link",
      {
        p_group_id: groupId,
        p_person_id: personId,
        p_user_id: invitedUserId,
      }
    );

    if (linkError) {
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        invitedUserId,
        personId,
        groupId,
        existingUser: !!existingUser,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
