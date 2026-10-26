import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "./server";

export async function getDbClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (serviceKey && supabaseUrl) {
    return createSupabaseClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // In standalone scripts, CLI, or test runners (outside Next.js server runtime)
  const isOutsideNextServer = !process.env.NEXT_RUNTIME || process.env.NODE_ENV === "test";
  if (isOutsideNextServer && anonKey && supabaseUrl) {
    return createSupabaseClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  try {
    return await createServerSupabaseClient();
  } catch {
    return createSupabaseClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
}
