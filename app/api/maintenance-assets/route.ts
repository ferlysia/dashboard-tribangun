import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function GET() {
  try {
    const [assetsRes, contractsRes] = await Promise.all([
      fetch(
        `${supabaseConfig.url}/rest/v1/assets` +
        `?select=*,contract_milestones!contract_milestones_asset_id_fkey(*),asset_documents!asset_documents_asset_id_fkey(*)` +
        `&order=site_name.asc,ne_id.asc`,
        { headers: headers() }
      ),
      fetch(
        `${supabaseConfig.url}/rest/v1/site_contracts?select=*&order=site_name.asc`,
        { headers: headers() }
      ),
    ])

    if (!assetsRes.ok)     throw new Error(await assetsRes.text())
    if (!contractsRes.ok)  throw new Error(await contractsRes.text())

    const rawAssets    = await assetsRes.json()
    const siteContracts = await contractsRes.json()

    // Rename nested keys to match the page's Asset interface
    const assets = rawAssets.map((a: Record<string, unknown>) => {
      const { contract_milestones, asset_documents, ...rest } = a
      return {
        ...rest,
        milestones: contract_milestones ?? [],
        documents:  asset_documents     ?? [],
      }
    })

    return NextResponse.json({ assets, siteContracts })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load assets" },
      { status: 500 }
    )
  }
}
