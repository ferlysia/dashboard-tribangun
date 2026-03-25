export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
}

export function assertSupabaseEnv() {
  const missing = [
    !supabaseConfig.url && "NEXT_PUBLIC_SUPABASE_URL",
    !supabaseConfig.anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    !supabaseConfig.serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean)

  if (missing.length > 0) {
    throw new Error(`Missing Supabase env: ${missing.join(", ")}`)
  }
}
