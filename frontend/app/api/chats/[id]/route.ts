import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// PUT /api/chats/[id] — update title, summary, or add a message
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Verify ownership
  const chat = await prisma.chat.findFirst({ where: { id, userId: session.user.id } })
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { title, summary, newMessage } = body

  const updated = await prisma.chat.update({
    where: { id },
    data: {
      ...(title   !== undefined && { title }),
      ...(summary !== undefined && { summary }),
      ...(newMessage && {
        messages: {
          create: {
            id:           newMessage.id || undefined,
            role:         newMessage.role,
            content:      newMessage.content,
            sources:      newMessage.sources ?? undefined,
            translations: newMessage.translations ?? undefined,
            activeLang:   newMessage.activeLang ?? undefined,
          },
        },
      }),
    },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  return NextResponse.json(updated)
}

// PATCH /api/chats/[id] — update a specific message (translations, activeLang)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { messageId, translations, activeLang } = await req.json()

  const chat = await prisma.chat.findFirst({ where: { id, userId: session.user.id } })
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.message.update({
    where: { id: messageId },
    data: {
      ...(translations !== undefined && { translations }),
      ...(activeLang   !== undefined && { activeLang }),
    },
  })

  return NextResponse.json({ ok: true })
}

// DELETE /api/chats/[id] — delete a chat
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const chat = await prisma.chat.findFirst({ where: { id, userId: session.user.id } })
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.chat.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
