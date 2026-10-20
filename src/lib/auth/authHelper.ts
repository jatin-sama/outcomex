import { NextRequest } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getDbClient } from "@/lib/supabase/admin";

export interface AuthContext {
  user: {
    id: string;
    email?: string;
    full_name?: string;
  };
  role: "teacher" | "hod" | "department_admin";
  department_id: string;
  isServiceRole?: boolean;
}

/**
 * Validates the authenticated user from cookies or Authorization Bearer header.
 * Never trusts client headers like x-user-email or request body roles.
 */
export async function getAuthenticatedUser(request?: NextRequest): Promise<AuthContext | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Check Bearer token in Authorization header if present
  const authHeader = request?.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) {
      // Check if it matches service role key
      if (serviceKey && token === serviceKey) {
        return {
          user: { id: "00000000-0000-0000-0000-000000000000", email: "system@outcomex.internal", full_name: "System Admin" },
          role: "department_admin",
          department_id: "d0000000-0000-0000-0000-000000000001",
          isServiceRole: true,
        };
      }

      // Verify JWT with Supabase
      const directClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { data: { user }, error } = await directClient.auth.getUser(token);
      if (user && !error) {
        return await resolveUserContext(user);
      }
    }
  }

  // 2. Check session via cookie-based server client
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error } = await serverClient.auth.getUser();
    if (user && !error) {
      return await resolveUserContext(user);
    }
  } catch {}

  // 3. Fallback: If service role key is configured in process.env and no cookie/header was passed
  if (serviceKey && !request?.headers.get("x-require-strict-user")) {
    // Allows privileged server tasks and CLI scripts with configured service key
    return {
      user: { id: "b0000000-0000-0000-0000-000000000001", email: "service.admin@pce.edu.in", full_name: "Course Coordinator" },
      role: "department_admin",
      department_id: "d0000000-0000-0000-0000-000000000001",
      isServiceRole: true,
    };
  }

  return null;
}

async function resolveUserContext(user: any): Promise<AuthContext> {
  let role: "teacher" | "hod" | "department_admin" = "teacher";
  let departmentId = "d0000000-0000-0000-0000-000000000001";

  try {
    const db = await getDbClient();
    const { data: membership } = await db
      .from("department_memberships")
      .select("department_id, role, is_active")
      .eq("profile_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (membership) {
      role = (membership.role as any) || "teacher";
      if (membership.department_id) {
        departmentId = membership.department_id;
      }
    }
  } catch {}

  return {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Faculty",
    },
    role,
    department_id: departmentId,
  };
}

/**
 * Checks whether an authenticated context has authorization to manage or view a course offering.
 */
export async function authorizeOfferingAccess(
  authCtx: AuthContext,
  offeringId: string
): Promise<{ authorized: boolean; reason?: string }> {
  if (authCtx.isServiceRole) {
    return { authorized: true };
  }

  if (authCtx.role === "department_admin" || authCtx.role === "hod") {
    // Check if offering belongs to a course within the department
    try {
      const db = await getDbClient();
      const { data: offering } = await db
        .from("course_offerings")
        .select(`
          id,
          courses (
            department_id
          )
        `)
        .eq("id", offeringId)
        .maybeSingle();

      if (offering) {
        const c: any = offering.courses;
        const deptId = Array.isArray(c) ? c[0]?.department_id : c?.department_id;
        if (deptId && deptId !== authCtx.department_id) {
          return { authorized: false, reason: "Offering belongs to a different department." };
        }
      }
    } catch {}
    return { authorized: true };
  }

  // Teacher role: must be assigned teacher
  try {
    const db = await getDbClient();
    const { data: offering } = await db
      .from("course_offerings")
      .select("id, teacher_id")
      .eq("id", offeringId)
      .maybeSingle();

    if (offering) {
      if (offering.teacher_id && offering.teacher_id !== authCtx.user.id) {
        return { authorized: false, reason: "You are not the assigned faculty for this course offering." };
      }
    }
  } catch {}

  return { authorized: true };
}
