import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const book = searchParams.get('book')
  const loc = searchParams.get('loc')
  const vachno = searchParams.get('vachno')
  const prakaran = searchParams.get('prakaran')
  const verse_no = searchParams.get('verse_no')
  const lang = searchParams.get('lang') || 'english'

  let endpoint = ''
  if (book === 'Vachnamrut' && loc && vachno) {
    endpoint = `/source/vachnamrut/${loc}/${vachno}?lang=${lang}`
  } else if (book === 'Swamini Vato' && prakaran && verse_no) {
    endpoint = `/source/swamini_vato/${prakaran}/${verse_no}?lang=${lang}`
  } else {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`)
    if (!res.ok) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Could not reach backend' }, { status: 503 })
  }
}
