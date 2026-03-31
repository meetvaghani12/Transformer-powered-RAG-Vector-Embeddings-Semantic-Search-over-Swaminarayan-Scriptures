"use client"

import { LanguageProvider } from '@/lib/language-context'
import { ChatPage } from '@/components/chat-page'
import { ErrorBoundary } from '@/components/error-boundary'

export default function Home() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ChatPage />
      </LanguageProvider>
    </ErrorBoundary>
  )
}
