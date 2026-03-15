import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  const body = await request.json()
  try {
    const res = await fetch(`${BACKEND_URL}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: body.query, answer: body.answer }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return NextResponse.json({ questions: [] })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ questions: [] })
  }
}
