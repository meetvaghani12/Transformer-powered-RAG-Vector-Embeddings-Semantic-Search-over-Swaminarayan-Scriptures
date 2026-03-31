import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

const LANGUAGE_MAP: Record<string, string> = {
  en: 'english',
  gu: 'gujarati',
  hi: 'hindi',
}

// Force Node.js runtime (not Edge) so we get proper streaming support
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let message: string
  let language: string
  let history: string

  try {
    const body = await request.json()
    message = body.message
    language = body.language ?? 'en'
    history = body.history ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  const backendLanguage = LANGUAGE_MAP[language] ?? 'english'

  let backendRes: Response
  try {
    backendRes = await fetch(`${BACKEND_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: message.trim(),
        language: backendLanguage,
        history,
      }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.error('Backend fetch error:', err)
    return NextResponse.json(
      { error: isTimeout ? 'Request timed out. The model is taking too long — please try again.' : 'Could not reach the backend. Make sure it is running on port 8000.' },
      { status: 503 }
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

  // Create a ReadableStream that forwards chunks from the backend SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const reader = backendRes.body?.getReader()
      if (!reader) {
        controller.enqueue(encoder.encode('event: error\ndata: {"error":"No backend stream"}\n\n'))
        controller.close()
        return
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
      } catch (err) {
        console.error('Stream relay error:', err)
      } finally {
        controller.close()
        reader.releaseLock()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
