import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { text, target } = body

  if (!text || !target) {
    return NextResponse.json({ error: 'Missing text or target' }, { status: 400 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, target }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Could not reach backend' }, { status: 503 })
  }
}
