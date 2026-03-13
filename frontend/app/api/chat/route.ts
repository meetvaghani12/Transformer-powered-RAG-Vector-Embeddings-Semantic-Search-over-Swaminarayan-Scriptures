import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

const LANGUAGE_MAP: Record<string, string> = {
  en: 'english',
  gu: 'gujarati',
  hi: 'hindi',
}

export async function POST(request: NextRequest) {
  // Parse request body
  let message: string
  let language: string

  try {
    const body = await request.json()
    message = body.message
    language = body.language ?? 'en'
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  const backendLanguage = LANGUAGE_MAP[language] ?? 'english'

  // Call backend
  let backendRes: Response
  try {
    backendRes = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: message.trim(), language: backendLanguage }),
      signal: AbortSignal.timeout(120_000), // 2 min timeout for slow local LLM
    })
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.error('Backend fetch error:', err)
    return NextResponse.json(
      { error: isTimeout ? 'Request timed out. The model is taking too long — please try again.' : 'Could not reach the backend. Make sure it is running on port 8000.' },
      { status: 503 }
    )
  }

  if (backendRes.status === 429) {
    return NextResponse.json(
      { error: 'The model is rate-limited. Please wait a moment and try again.' },
      { status: 429 }
    )
  }

  if (!backendRes.ok) {
    let detail = ''
    try { detail = (await backendRes.json()).detail ?? '' } catch { /* ignore */ }
    console.error(`Backend error ${backendRes.status}: ${detail}`)
    return NextResponse.json(
      { error: `Backend error (${backendRes.status})${detail ? ': ' + detail : ''}. Please try again.` },
      { status: 502 }
    )
  }

  let data: { answer?: string; sources?: unknown[]; total_matches?: unknown }
  try {
    data = await backendRes.json()
  } catch {
    return NextResponse.json({ error: 'Received an invalid response from the backend.' }, { status: 502 })
  }

  if (!data.answer) {
    return NextResponse.json({ error: 'The model returned an empty answer. Please try again.' }, { status: 502 })
  }

  return NextResponse.json({
    answer: data.answer,
    sources: data.sources ?? [],
    total_matches: data.total_matches,
  })
}
