import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

const BUCKET = "project-photos"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const path = formData.get("path") as string | null

    if (!file || !path) {
      return NextResponse.json({ error: "file dan path wajib diisi" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const url = `${supabaseConfig.url}/storage/v1/object/${BUCKET}/${path}`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: supabaseConfig.serviceRoleKey,
        Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        "Content-Type": file.type || "image/jpeg",
        "x-upsert": "true",
      },
      body: buffer,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Storage error: ${text}`)
    }

    const publicUrl = `${supabaseConfig.url}/storage/v1/object/public/${BUCKET}/${path}`
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
