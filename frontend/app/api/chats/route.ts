import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// GET /api/chats — fetch all chats for current user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chats = await prisma.chat.findMany({
    where: { userId: session.user.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(chats)
}

// POST /api/chats — create a new chat (with optional initial messages)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, title, summary, messages, createdAt } = await req.json()

  const chat = await prisma.chat.create({
    data: {
      id:      id || undefined,
      userId:  session.user.id,
      title:   title || 'New Chat',
      summary: summary || '',
      createdAt: createdAt ? new Date(createdAt) : undefined,
      messages: messages?.length
        ? {
            create: messages.map((m: {
              id: string; role: string; content: string;
              sources?: object; translations?: object; activeLang?: string; createdAt?: string
            }) => ({
              id:           m.id || undefined,
              role:         m.role,
              content:      m.content,
              sources:      m.sources ?? undefined,
              translations: m.translations ?? undefined,
              activeLang:   m.activeLang ?? undefined,
              createdAt:    m.createdAt ? new Date(m.createdAt) : undefined,
            })),
          }
        : undefined,
    },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  return NextResponse.json(chat)
}
