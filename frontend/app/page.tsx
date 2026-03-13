"use client"

import { LanguageProvider } from '@/lib/language-context'
import { ChatPage } from '@/components/chat-page'

export default function Home() {
  return (
    <LanguageProvider>
      <ChatPage />
    </LanguageProvider>
  )
}
