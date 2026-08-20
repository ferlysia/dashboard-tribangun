import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

const BUCKET = "tool-inspection-photos"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

function storageHeaders(contentType: string) {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": contentType,
    "x-upsert":    "true",
  }
}

async function deleteStorageObject(path: string) {
  await fetch(`${supabaseConfig.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "DELETE",
    headers: {
      apikey:        supabaseConfig.serviceRoleKey,
      Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    },
  }).catch(() => { /* best-effort cleanup */ })
}

// Expects the file to already be compressed client-side (browser-image-
// compression, webp, capped ~0.3MB) — this route just forwards it and
// records the row. Storage insert then DB insert are sequential; a failed
// DB insert (e.g. the item was flipped back to GOOD mid-upload, tripping
// fn_enforce_photo_requires_bad_condition) rolls back the uploaded object
// so nothing orphaned sits in the bucket.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params
  let storagePath: string | null = null
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const ext = (file.type.split("/")[1] || "webp").split("+")[0]
    storagePath = `${id}/${itemId}/${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const uploadRes = await fetch(
      `${supabaseConfig.url}/storage/v1/object/${BUCKET}/${storagePath}`,
      { method: "POST", headers: storageHeaders(file.type || "image/webp"), body: Buffer.from(arrayBuffer) }
    )
    if (!uploadRes.ok) throw new Error(`Storage error: ${await uploadRes.text()}`)

    const dbRes = await fetch(`${supabaseConfig.url}/rest/v1/tool_inspection_photos`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify({ inspection_item_id: itemId, storage_path: storagePath }),
    })
    if (!dbRes.ok) {
      await deleteStorageObject(storagePath)
      throw new Error(await dbRes.text())
    }
    const [data] = await dbRes.json()

    return NextResponse.json({
      data: { ...data, url: `${supabaseConfig.url}/storage/v1/object/public/${BUCKET}/${storagePath}` },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload inspection photo" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const photoId = searchParams.get("photo_id")
    if (!photoId) {
      return NextResponse.json({ error: "photo_id is required" }, { status: 400 })
    }

    const getRes = await fetch(
      `${supabaseConfig.url}/rest/v1/tool_inspection_photos?id=eq.${photoId}&select=storage_path`,
      { headers: headers() }
    )
    if (!getRes.ok) throw new Error(await getRes.text())
    const [photo] = await getRes.json() as { storage_path: string }[]
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 })
    }

    await deleteStorageObject(photo.storage_path)

    const delRes = await fetch(`${supabaseConfig.url}/rest/v1/tool_inspection_photos?id=eq.${photoId}`, {
      method: "DELETE", headers: headers(),
    })
    if (!delRes.ok) throw new Error(await delRes.text())

    return NextResponse.json({ data: { id: photoId } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete inspection photo" },
      { status: 500 }
    )
  }
}
