"use client"

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import type { Message, Source } from '@/lib/chat-types'
import { loadChats, saveChats } from '@/lib/chat-storage'
import { useChatDb } from '@/hooks/use-chat-db'
import { useChatState } from '@/hooks/use-chat-state'
import { ChatSidebar } from '@/components/chat-sidebar'
import { ChatHeader } from '@/components/chat-header'
import { ChatMessages } from '@/components/chat-messages'
import { ChatInput } from '@/components/chat-input'
import { SourceModal } from '@/components/source-modal'

export function ChatPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.id
  const { dbSaveChat, dbAddMessage, dbUpdateSummary, dbDeleteChat, dbUpdateMessageTranslation } = useChatDb()
  const { state, dispatch } = useChatState()

  const {
    chats, currentChatId, input, isLoading, expandedSources,
    translatingIds, sidebarOpen, fullSource, loadingSource,
    sourceLanguage, pendingSourceRef,
  } = state

  // Persist helper — saves to localStorage when not logged in
  const persist = (updatedChats: typeof chats) => {
    if (!isLoggedIn) saveChats(updatedChats)
  }

  // Open sidebar by default on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) dispatch({ type: 'SET_SIDEBAR', open: true })
  }, [])

  // Load chats — from DB if logged in, localStorage if anonymous
  useEffect(() => {
    if (isLoggedIn) {
      fetch('/api/chats')
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) dispatch({ type: 'SET_CHATS', chats: data }) })
        .catch(() => {})
    } else {
      dispatch({ type: 'SET_CHATS', chats: loadChats() })
    }
  }, [isLoggedIn])

  const currentChat = chats.find(c => c.id === currentChatId) ?? null
  const messages = currentChat?.messages ?? []

  // ── Handlers ────────────────────────────────────────────────────────────────

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: 'DELETE_CHAT', id })
    const updated = chats.filter(c => c.id !== id)
    persist(updated)
    if (isLoggedIn) dbDeleteChat(id)
  }

  const fetchSource = async (src: Source, lang: string) => {
    dispatch({ type: 'SET_LOADING_SOURCE', value: true })
    dispatch({ type: 'SET_FULL_SOURCE', source: null })
    const params = new URLSearchParams({ book: src.book, lang })
    if (src.book === 'Vachnamrut' && src.loc && src.vachno) {
      params.set('loc', src.loc)
      params.set('vachno', src.vachno)
    } else if (src.book === 'Swamini Vato' && src.prakaran && src.verse_no) {
      params.set('prakaran', String(src.prakaran))
      params.set('verse_no', String(src.verse_no))
    }
    try {
      const res = await fetch(`/api/source?${params}`, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error('not found')
      const data = await res.json()
      if (data?.text) dispatch({ type: 'SET_FULL_SOURCE', source: data })
    } catch {
      // silently close modal on error
    } finally {
      dispatch({ type: 'SET_LOADING_SOURCE', value: false })
    }
  }

  const openFullSource = (src: Source) => {
    dispatch({ type: 'OPEN_SOURCE_MODAL', src })
    fetchSource(src, 'english')
  }

  const handleSourceLanguageChange = (lang: string) => {
    dispatch({ type: 'SET_SOURCE_LANGUAGE', lang })
    if (pendingSourceRef) fetchSource(pendingSourceRef, lang)
  }

  const handleTranslate = async (msgId: string, targetLang: 'en' | 'gu' | 'hi') => {
    if (targetLang === 'en') {
      const updated = chats.map(c => ({
        ...c,
        messages: c.messages.map(m => m.id === msgId ? { ...m, activeLang: 'en' as const } : m),
      }))
      dispatch({ type: 'SET_CHATS', chats: updated })
      persist(updated)
      return
    }

    const msg = chats.flatMap(c => c.messages).find(m => m.id === msgId)
    if (!msg) return
    if (msg.translations?.[targetLang]) {
      const updated = chats.map(c => ({
        ...c,
        messages: c.messages.map(m => m.id === msgId ? { ...m, activeLang: targetLang } : m),
      }))
      dispatch({ type: 'SET_CHATS', chats: updated })
      persist(updated)
      return
    }

    // Set lang optimistically
    const optimistic = chats.map(c => ({
      ...c,
      messages: c.messages.map(m => m.id === msgId ? { ...m, activeLang: targetLang } : m),
    }))
    dispatch({ type: 'SET_CHATS', chats: optimistic })
    persist(optimistic)
    dispatch({ type: 'ADD_TRANSLATING', id: msgId })

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.content, target: targetLang }),
      })
      const data = await res.json()
      if (data.translated) {
        const updated = chats.map(c => {
          const hasMsg = c.messages.some(m => m.id === msgId)
          if (!hasMsg) return c
          const newTranslations = { ...(c.messages.find(m => m.id === msgId)?.translations ?? {}), [targetLang]: data.translated }
          if (isLoggedIn) dbUpdateMessageTranslation(c.id, msgId, newTranslations, targetLang)
          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === msgId ? { ...m, translations: newTranslations, activeLang: targetLang } : m
            ),
          }
        })
        dispatch({ type: 'SET_CHATS', chats: updated })
        persist(updated)
      }
    } catch {
      const fallback = chats.map(c => ({
        ...c,
        messages: c.messages.map(m => m.id === msgId ? { ...m, activeLang: 'en' as const } : m),
      }))
      dispatch({ type: 'SET_CHATS', chats: fallback })
      persist(fallback)
    } finally {
      dispatch({ type: 'REMOVE_TRANSLATING', id: msgId })
    }
  }

  // ── Submit (streaming) ──────────────────────────────────────────────────────

  const submitLock = useRef(false)

  const handleSubmit = async (question?: string) => {
    const messageText = question || input.trim()
    if (!messageText || isLoading || submitLock.current) return
    submitLock.current = true
    setTimeout(() => { submitLock.current = false }, 500)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
    }

    let activeChatId = currentChatId
    let updatedChats = [...chats]

    if (!activeChatId) {
      const newChat = {
        id: Date.now().toString(),
        title: messageText.slice(0, 50),
        messages: [userMessage],
        summary: '',
        createdAt: Date.now(),
      }
      updatedChats = [...chats, newChat]
      activeChatId = newChat.id
      dispatch({ type: 'SET_CURRENT_CHAT', id: activeChatId })
      dispatch({ type: 'SET_CHATS', chats: updatedChats })
      persist(updatedChats)
      if (isLoggedIn) dbSaveChat(newChat)
    } else {
      updatedChats = updatedChats.map(c =>
        c.id === activeChatId ? { ...c, messages: [...c.messages, userMessage] } : c
      )
      dispatch({ type: 'SET_CHATS', chats: updatedChats })
      persist(updatedChats)
      if (isLoggedIn) dbAddMessage(activeChatId, userMessage)
    }

    dispatch({ type: 'SET_INPUT', value: '' })
    dispatch({ type: 'SET_LOADING', value: true })

    try {
      const currentSummary = loadChats().find(c => c.id === activeChatId)?.summary ?? ''

      // Build conversation context from recent messages
      const currentChat = updatedChats.find(c => c.id === activeChatId)
      const recentMessages = (currentChat?.messages ?? [])
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('http://localhost:8000/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: messageText,
          language: 'english',
          history: currentSummary,
          messages: recentMessages,
        }),
      })

      if (!response.ok) {
        let errMsg = `Error ${response.status}`
        try { const d = await response.json(); errMsg = d.error || errMsg } catch { /* ignore */ }
        throw new Error(errMsg)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream available')

      const decoder = new TextDecoder()
      const assistantMsgId = (Date.now() + 1).toString()
      let fullAnswer = ''
      let sources: Message['sources'] = []
      const capturedChatId = activeChatId!

      // Add empty streaming placeholder
      dispatch({ type: 'ADD_MESSAGE', chatId: capturedChatId, message: { id: assistantMsgId, role: 'assistant', content: '', sources: [] } })

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const payload = JSON.parse(line.slice(6))
              if (currentEvent === 'token' && payload.token) {
                fullAnswer += payload.token
                dispatch({ type: 'UPDATE_MESSAGE', chatId: capturedChatId, messageId: assistantMsgId, updates: { content: fullAnswer } })
              } else if (currentEvent === 'sources') {
                sources = payload.sources ?? []
                dispatch({ type: 'UPDATE_MESSAGE', chatId: capturedChatId, messageId: assistantMsgId, updates: { sources } })
              } else if (currentEvent === 'error') {
                throw new Error(payload.error || 'Stream error')
              }
            } catch (e) {
              if (e instanceof Error && e.message === 'Stream error') throw e
            }
            currentEvent = ''
          }
        }
      }

      // Persist final message
      const finalMessage: Message = { id: assistantMsgId, role: 'assistant', content: fullAnswer, sources }
      updatedChats = updatedChats.map(c =>
        c.id === capturedChatId ? { ...c, messages: [...c.messages, finalMessage] } : c
      )
      persist(updatedChats)
      if (isLoggedIn) dbAddMessage(capturedChatId, finalMessage)

      // Background: suggestions
      fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: messageText, answer: fullAnswer }),
      }).then(r => r.json()).then(({ questions }) => {
        if (questions?.length) {
          dispatch({ type: 'UPDATE_MESSAGE', chatId: capturedChatId, messageId: assistantMsgId, updates: { suggestions: questions } })
        }
      }).catch(() => {})

      // Background: summarize
      const allMessages = updatedChats.find(c => c.id === capturedChatId)?.messages ?? []
      const messagesForSummary = allMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesForSummary }),
      }).then(r => r.json()).then(({ summary }) => {
        if (summary) {
          dispatch({ type: 'UPDATE_CHAT_SUMMARY', chatId: capturedChatId, summary })
          if (isLoggedIn) dbUpdateSummary(capturedChatId, summary)
        }
      }).catch(() => { })
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'error', content: errMsg }
      updatedChats = updatedChats.map(c =>
        c.id === activeChatId ? { ...c, messages: [...c.messages, errorMessage] } : c
      )
      dispatch({ type: 'SET_CHATS', chats: updatedChats })
      persist(updatedChats)
    } finally {
      dispatch({ type: 'SET_LOADING', value: false })
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar
        chats={chats}
        currentChatId={currentChatId}
        sidebarOpen={sidebarOpen}
        onSelectChat={(id) => dispatch({ type: 'SELECT_CHAT', id })}
        onNewChat={() => dispatch({ type: 'NEW_CHAT' })}
        onDeleteChat={deleteChat}
        onCloseSidebar={() => dispatch({ type: 'SET_SIDEBAR', open: false })}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          onToggleSidebar={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          onNewChat={() => dispatch({ type: 'NEW_CHAT' })}
          currentChat={currentChat}
        />

        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          expandedSources={expandedSources}
          translatingIds={translatingIds}
          onToggleSource={(id) => dispatch({ type: 'TOGGLE_SOURCE', id })}
          onOpenFullSource={openFullSource}
          onTranslate={handleTranslate}
          onSubmitQuestion={handleSubmit}
        />

        <ChatInput
          input={input}
          isLoading={isLoading}
          onInputChange={(v) => dispatch({ type: 'SET_INPUT', value: v })}
          onSubmit={() => handleSubmit()}
        />
      </div>

      <SourceModal
        fullSource={fullSource}
        loadingSource={loadingSource}
        pendingSourceRef={pendingSourceRef}
        sourceLanguage={sourceLanguage}
        onChangeLanguage={handleSourceLanguageChange}
        onClose={() => dispatch({ type: 'CLOSE_SOURCE_MODAL' })}
      />
    </div>
  )
}
