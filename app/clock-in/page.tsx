import { supabaseConfig } from "@/lib/supabase/config"
import { ClockInShell } from "./_components/clock-in-shell"

// Recently-used names for the datalist autocomplete — mirrors the
// pm_schedules.assignee autocomplete-from-history precedent. Fetched from
// the last 200 rows (not a distinct-name RPC) and deduped here, since
// PostgREST has no plain `SELECT DISTINCT column` projection.
async function getRecentNames(): Promise<string[]> {
  try {
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/attendance_logs?select=worker_name&order=recorded_at.desc&limit=200`,
      {
        headers: {
          apikey:        supabaseConfig.serviceRoleKey,
          Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        },
        cache: "no-store",
      }
    )
    if (!res.ok) return []
    const rows = await res.json() as { worker_name: string }[]
    const seen = new Set<string>()
    const names: string[] = []
    for (const row of rows) {
      if (!seen.has(row.worker_name)) {
        seen.add(row.worker_name)
        names.push(row.worker_name)
      }
      if (names.length >= 50) break
    }
    return names
  } catch {
    // Autocomplete is a nice-to-have — a misconfigured/unreachable Supabase
    // should degrade to an empty datalist, not take down the whole page.
    return []
  }
}

export default async function ClockInPage() {
  const recentNames = await getRecentNames()
  return <ClockInShell recentNames={recentNames} />
}
