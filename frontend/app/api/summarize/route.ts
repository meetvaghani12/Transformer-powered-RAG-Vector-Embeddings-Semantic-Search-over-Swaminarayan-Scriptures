import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    const res = await fetch(`${BACKEND_URL}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(60_000),
    })

    const data = await res.json()
    return NextResponse.json({ summary: data.summary ?? '' })
  } catch {
    return NextResponse.json({ summary: '' })
  }
}
