/**
 * DELETE /api/projects/[key]
 *
 * Admin-only hard purge of a project and every related row across all tables.
 * Authorization: reads __tup_session JWT → role must be "ADMIN".
 * Execution:     calls Supabase RPC delete_project_cascade(p_key) which runs
 *                atomically in a single DB transaction (SECURITY DEFINER fn).
 * Audit:         writes a deletion record to activity_logs.
 *
 * Returns: { ok: true, deleted: { ... row counts per table } }
 * Errors:  403 if not ADMIN, 404 if project not found, 500 on DB failure
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyToken, COOKIE_NAME }  from "@/lib/auth/session"
import { supabaseConfig }            from "@/lib/supabase/config"

function svc() {
  return {
    apikey:         supabaseConfig.serviceRoleKey,
    Authorization:  `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  // ── 1. RBAC: verify ADMIN role from session JWT ───────────────────────────
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 })
  }

  let role: string
  let actorEmail: string
  try {
    const payload = await verifyToken(token)
    role        = (payload.role as string) ?? "STAFF"
    actorEmail  = (payload.email as string) ?? "unknown"
  } catch {
    return NextResponse.json({ error: "Sesi tidak valid atau kedaluwarsa." }, { status: 401 })
  }

  if (role !== "ADMIN") {
    return NextResponse.json(
      { error: "Akses ditolak. Hanya ADMIN yang dapat menghapus proyek." },
      { status: 403 }
    )
  }

  // ── 2. Resolve and validate project key ───────────────────────────────────
  const { key } = await params
  const projectKey = decodeURIComponent(key).trim()

  if (!projectKey) {
    return NextResponse.json({ error: "project_key wajib diisi." }, { status: 400 })
  }

  // Verify project exists before attempting delete
  const checkRes = await fetch(
    `${supabaseConfig.url}/rest/v1/project_details?project_key=eq.${encodeURIComponent(projectKey)}&select=project_key,display_name`,
    { headers: svc(), cache: "no-store" }
  )
  const checkRows: { project_key: string; display_name: string }[] = checkRes.ok
    ? await checkRes.json() : []

  if (checkRows.length === 0) {
    return NextResponse.json(
      { error: `Proyek "${projectKey}" tidak ditemukan.` },
      { status: 404 }
    )
  }

  const displayName = checkRows[0].display_name || projectKey

  // ── 3. Execute atomic cascade delete via Supabase RPC ────────────────────
  //    delete_project_cascade runs in a single DB transaction (SECURITY DEFINER).
  //    All child rows are deleted before project_details — no orphaned rows.
  const rpcRes = await fetch(
    `${supabaseConfig.url}/rest/v1/rpc/delete_project_cascade`,
    {
      method: "POST",
      headers: { ...svc(), Prefer: "return=representation" },
      body: JSON.stringify({ p_key: projectKey }),
    }
  )

  if (!rpcRes.ok) {
    const errText = await rpcRes.text()
    return NextResponse.json(
      { error: `Gagal menghapus proyek: ${errText}` },
      { status: 500 }
    )
  }

  const deleted = await rpcRes.json()

  // ── 4. Write audit log ────────────────────────────────────────────────────
  await fetch(`${supabaseConfig.url}/rest/v1/activity_logs`, {
    method: "POST",
    headers: { ...svc(), Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_email:  actorEmail,
      action:       "DELETE",
      entity_type:  "project",
      entity_id:    projectKey,
      summary:      `ADMIN menghapus proyek "${displayName}" (${projectKey}) beserta seluruh data terkait`,
      payload:      { project_key: projectKey, display_name: displayName, deleted_rows: deleted },
    }),
  }).catch(() => { /* audit failure must not block the response */ })

  return NextResponse.json({
    ok:          true,
    project_key: projectKey,
    display_name: displayName,
    deleted,
  })
}
