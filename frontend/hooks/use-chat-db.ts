import type { Chat, Message } from '@/lib/chat-types'

export function useChatDb() {
  const dbSaveChat = async (chat: Chat) => {
    await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chat),
    })
  }

  const dbAddMessage = async (chatId: string, message: Message) => {
    await fetch(`/api/chats/${chatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newMessage: message }),
    })
  }

  const dbUpdateSummary = async (chatId: string, summary: string) => {
    await fetch(`/api/chats/${chatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    })
  }

  const dbDeleteChat = async (chatId: string) => {
    await fetch(`/api/chats/${chatId}`, { method: 'DELETE' })
  }

  const dbUpdateMessageTranslation = async (chatId: string, messageId: string, translations: object, activeLang: string) => {
    await fetch(`/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, translations, activeLang }),
    })
  }

  return { dbSaveChat, dbAddMessage, dbUpdateSummary, dbDeleteChat, dbUpdateMessageTranslation }
}
