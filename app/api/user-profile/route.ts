import { NextResponse } from "next/server"
import { upsertUserProfile } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.email || !body.full_name) {
      return NextResponse.json({ error: "email dan full_name wajib diisi" }, { status: 400 })
    }

    const profile = await upsertUserProfile({
      email: body.email,
      fullName: body.full_name,
      role: body.role,
    })

    return NextResponse.json({ data: profile })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal sync user profile" },
      { status: 500 }
    )
  }
}
