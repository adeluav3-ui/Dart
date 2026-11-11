import { NextResponse } from 'next/server'
import { getBanks } from '@/lib/monnify'

// Cache the bank list for 24 hours — it rarely changes.
export const revalidate = 86400

export async function GET() {
  try {
    const banks = await getBanks()
    return NextResponse.json(banks, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'Could not fetch bank list' }, { status: 502 })
  }
}
