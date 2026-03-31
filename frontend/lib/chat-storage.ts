import type { Chat } from './chat-types'

const STORAGE_KEY = 'vie_chats'

export function loadChats(): Chat[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveChats(chats: Chat[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
}

export function groupChatsByDate(chats: Chat[]) {
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const yesterdayStart = todayStart - 86400000
  const weekStart = todayStart - 6 * 86400000

  const groups: { label: string; chats: Chat[] }[] = [
    { label: 'Today', chats: [] },
    { label: 'Yesterday', chats: [] },
    { label: 'Previous 7 Days', chats: [] },
    { label: 'Older', chats: [] },
  ]

  for (const chat of [...chats].reverse()) {
    if (chat.createdAt >= todayStart) groups[0].chats.push(chat)
    else if (chat.createdAt >= yesterdayStart) groups[1].chats.push(chat)
    else if (chat.createdAt >= weekStart) groups[2].chats.push(chat)
    else groups[3].chats.push(chat)
  }

  return groups.filter(g => g.chats.length > 0)
}
