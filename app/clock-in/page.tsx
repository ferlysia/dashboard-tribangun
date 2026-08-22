import { supabaseConfig } from "@/lib/supabase/config"
import { ClockInShell } from "./_components/clock-in-shell"
import type { Employee } from "./_components/employee-combobox"

// Employee picker source list — fetched server-side (RSC) rather than by
// the client on mount, so it's already in the initial HTML payload instead
// of costing an extra request off the critical clock-in submit path. Only
// employee_id/full_name are selected — never the PII columns on this table
// (address, bank/ID numbers, etc.), since this page is public/unauthenticated.
async function getEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/employees?select=employee_id,full_name&employee_id=not.is.null&order=full_name.asc&limit=1000`,
      {
        headers: {
          apikey:        supabaseConfig.serviceRoleKey,
          Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        },
        cache: "no-store",
      }
    )
    if (!res.ok) return []
    return await res.json() as Employee[]
  } catch {
    // The picker degrading to empty is better than crashing the whole page.
    return []
  }
}

export default async function ClockInPage() {
  const employees = await getEmployees()
  return <ClockInShell employees={employees} />
}
