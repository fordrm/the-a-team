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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: get caller from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { group_id, email, role, person_label } = body;

    if (!group_id || !email || !role) {
      return new Response(
        JSON.stringify({ error: "group_id, email, and role are required" }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // M-3: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const allowedRoles = ["coordinator", "supporter", "supported_person"];
    if (!allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role: ${role}` }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (role === "supported_person" && (!person_label || !person_label.trim())) {
      return new Response(
        JSON.stringify({
          error: "person_label is required for supported_person role",
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: membership } = await adminClient
      .from("group_memberships")
      .select("role")
      .eq("group_id", group_id)
      .eq("user_id", caller.id)
      .eq("role", "coordinator")
      .eq("is_active", true)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Only coordinators can invite" }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
    );

    let invitedUserId: string;

    if (existingUser) {
      invitedUserId = existingUser.id;
    } else {
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email.trim().toLowerCase());
      if (inviteError) {
        return new Response(
          JSON.stringify({ error: inviteError.message }),
          {
            status: 400,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }
      invitedUserId = inviteData.user.id;
    }

    let mode: string;

    if (role === "supported_person") {
      const { error: rpcError } = await adminClient.rpc(
        "upsert_supported_person",
        {
          p_group_id: group_id,
          p_subject_user_id: invitedUserId,
          p_label: person_label.trim(),
        }
      );
      if (rpcError) {
        return new Response(
          JSON.stringify({ error: rpcError.message }),
          {
            status: 500,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }
      mode = "person_link";
    } else {
      const { data: existingMembership } = await adminClient
        .from("group_memberships")
        .select("id, is_active")
        .eq("group_id", group_id)
        .eq("user_id", invitedUserId)
        .maybeSingle();

      if (existingMembership) {
        if (existingMembership.is_active) {
          return new Response(
            JSON.stringify({ error: "User is already an active member" }),
            {
              status: 400,
              headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
            }
          );
        }
        await adminClient
          .from("group_memberships")
          .update({ role, is_active: true })
          .eq("id", existingMembership.id);
      } else {
        await adminClient.from("group_memberships").insert({
          group_id,
          user_id: invitedUserId,
          role,
          is_active: true,
          capabilities: {},
        });
      }
      mode = "membership";
    }

    return new Response(
      JSON.stringify({
        ok: true,
        invited_user_id: invitedUserId,
        role,
        group_id,
        mode,
        existing_user: !!existingUser,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[invite-to-group] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
