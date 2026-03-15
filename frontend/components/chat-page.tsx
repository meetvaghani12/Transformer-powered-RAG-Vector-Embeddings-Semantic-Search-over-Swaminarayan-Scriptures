"use client"

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/language-context'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Send, Plus, BookOpen, ChevronDown, Trash2, PanelLeft, X, ExternalLink, LogIn, LogOut, User } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Source {
  book: string
  reference: string
  title?: string
  text: string
  score: number
  loc?: string
  vachno?: string
  prakaran?: string
  verse_no?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  sources?: Source[]
  translations?: { gu?: string; hi?: string }
  activeLang?: 'en' | 'gu' | 'hi'
}

interface FullSource {
  book: string
  title?: string
  place?: string
  loc?: string
  vachno?: string
  prakaran?: string
  verse_no?: string
  text: string
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  summary: string   // rolling summary of all previous messages
  createdAt: number
}

const STORAGE_KEY = 'vie_chats'

function loadChats(): Chat[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveChats(chats: Chat[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
}

function groupChatsByDate(chats: Chat[]) {
  const now = Date.now()
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

/**
 * Render scraped source text with proper formatting.
 * The scraper used get_text(separator="\n") which turned <i>word</i> into \nword\n.
 * We detect those short segments surrounded by longer ones and restore them as <em>.
 * \n\n = real paragraph break (Vachnamrut), lone \n = inline italic term (Swamini Vato).
 */
function renderSourceText(text: string) {
  const paragraphs = text.split('\n\n')

  return (
    <div className="text-sm text-foreground leading-8">
      {paragraphs.map((para, pIdx) => {
        const parts = para.split('\n').map(p => p.trim()).filter(Boolean)

        const nodes: React.ReactNode[] = []
        parts.forEach((part, i) => {
          const prevLen = i > 0 ? parts[i - 1].length : 9999
          const nextLen = i < parts.length - 1 ? parts[i + 1].length : 9999
          // A segment is an inline italic term if:
          // - shorter than both neighbours
          // - no slash or bracket (not a citation like "(4/48)" or "/")
          // - only letters/spaces/diacritics (was originally <i>word</i>)
          const isItalicTerm =
            part.length < 40 &&
            prevLen > part.length &&
            nextLen > part.length &&
            !/^[/()\d]/.test(part) &&
            !part.includes('/') &&
            /^[\p{L}\s\-']+$/u.test(part)

          if (i > 0) nodes.push(' ')
          if (isItalicTerm) {
            nodes.push(<em key={i} className="italic text-muted-foreground">{part}</em>)
          } else {
            nodes.push(<span key={i}>{part}</span>)
          }
        })

        return (
          <p key={pIdx} className={pIdx > 0 ? 'mt-4' : ''}>
            {nodes}
          </p>
        )
      })}
    </div>
  )
}

export function ChatPage() {
  const { t } = useLanguage()
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.id
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [fullSource, setFullSource] = useState<FullSource | null>(null)
  const [loadingSource, setLoadingSource] = useState(false)
  const [sourceLanguage, setSourceLanguage] = useState<string>('english')
  const [pendingSourceRef, setPendingSourceRef] = useState<Source | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── DB helpers (used when logged in) ────────────────────────────────────────
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

  // Load chats — from DB if logged in, localStorage if anonymous
  useEffect(() => {
    if (isLoggedIn) {
      fetch('/api/chats')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setChats(data)
        })
        .catch(() => {})
    } else {
      setChats(loadChats())
    }
  }, [isLoggedIn])

  const currentChat = chats.find(c => c.id === currentChatId) ?? null
  const messages = currentChat?.messages ?? []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const updateChats = (updated: Chat[]) => {
    setChats(updated)
    if (!isLoggedIn) saveChats(updated)
  }

  const handleSubmit = async (question?: string) => {
    const messageText = question || input.trim()
    if (!messageText || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
    }

    let activeChatId = currentChatId
    let updatedChats = [...chats]

    // Create new chat if none active
    if (!activeChatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: messageText.slice(0, 50),
        messages: [userMessage],
        summary: '',
        createdAt: Date.now(),
      }
      updatedChats = [...chats, newChat]
      activeChatId = newChat.id
      setCurrentChatId(activeChatId)
      updateChats(updatedChats)
      if (isLoggedIn) dbSaveChat(newChat)
    } else {
      updatedChats = updatedChats.map(c =>
        c.id === activeChatId
          ? { ...c, messages: [...c.messages, userMessage] }
          : c
      )
      updateChats(updatedChats)
      if (isLoggedIn) dbAddMessage(activeChatId, userMessage)
    }

    setInput('')
    setIsLoading(true)

    try {
      // Read summary directly from localStorage — avoids race condition where
      // React state hasn't re-rendered yet after the background summarize call.
      const currentSummary = loadChats().find(c => c.id === activeChatId)?.summary ?? ''

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, history: currentSummary }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}`)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources ?? [],
      }

      updatedChats = updatedChats.map(c =>
        c.id === activeChatId
          ? { ...c, messages: [...c.messages, assistantMessage] }
          : c
      )
      updateChats(updatedChats)
      if (isLoggedIn) dbAddMessage(activeChatId!, assistantMessage)

      // Summarize all messages so far (runs in background, updates chat for next question)
      const allMessages = updatedChats.find(c => c.id === activeChatId)?.messages ?? []
      const messagesForSummary = allMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesForSummary }),
      }).then(r => r.json()).then(({ summary }) => {
        if (summary) {
          setChats(prev => {
            const updated = prev.map(c =>
              c.id === activeChatId ? { ...c, summary } : c
            )
            if (!isLoggedIn) saveChats(updated)
            return updated
          })
          if (isLoggedIn && activeChatId) dbUpdateSummary(activeChatId, summary)
        }
      }).catch(() => { })
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'error',
        content: errMsg,
      }
      updatedChats = updatedChats.map(c =>
        c.id === activeChatId
          ? { ...c, messages: [...c.messages, errorMessage] }
          : c
      )
      updateChats(updatedChats)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const toggleSource = (id: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const startNewChat = () => {
    setCurrentChatId(null)
    setExpandedSources(new Set())
  }

  const fetchSource = async (src: Source, lang: string) => {
    setLoadingSource(true)
    setFullSource(null)
    const params = new URLSearchParams({ book: src.book, lang })
    if (src.book === 'Vachnamrut' && src.loc && src.vachno) {
      params.set('loc', src.loc)
      params.set('vachno', src.vachno)
    } else if (src.book === 'Swamini Vato' && src.prakaran && src.verse_no) {
      params.set('prakaran', String(src.prakaran))
      params.set('verse_no', String(src.verse_no))
    }
    try {
      const res = await fetch(`/api/source?${params}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error('not found')
      const data = await res.json()
      if (data?.text) setFullSource(data)
    } catch {
      // silently close modal on error or timeout
    } finally {
      setLoadingSource(false)
    }
  }

  const openFullSource = (src: Source) => {
    setSourceLanguage('english')
    setPendingSourceRef(src)
    fetchSource(src, 'english')
  }

  const handleTranslate = async (msgId: string, targetLang: 'en' | 'gu' | 'hi') => {
    // Switching back to EN — just update activeLang
    if (targetLang === 'en') {
      setChats(prev => {
        const updated = prev.map(c => ({
          ...c,
          messages: c.messages.map(m => m.id === msgId ? { ...m, activeLang: 'en' as const } : m),
        }))
        saveChats(updated)
        return updated
      })
      return
    }

    // Check cache first
    const msg = chats.flatMap(c => c.messages).find(m => m.id === msgId)
    if (!msg) return
    if (msg.translations?.[targetLang]) {
      setChats(prev => {
        const updated = prev.map(c => ({
          ...c,
          messages: c.messages.map(m => m.id === msgId ? { ...m, activeLang: targetLang } : m),
        }))
        saveChats(updated)
        return updated
      })
      return
    }

    // Set activeLang optimistically + mark as loading
    setChats(prev => {
      const updated = prev.map(c => ({
        ...c,
        messages: c.messages.map(m => m.id === msgId ? { ...m, activeLang: targetLang } : m),
      }))
      saveChats(updated)
      return updated
    })
    setTranslatingIds(prev => new Set(prev).add(msgId))

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.content, target: targetLang }),
      })
      const data = await res.json()
      if (data.translated) {
        setChats(prev => {
          const updated = prev.map(c => {
            const hasMsg = c.messages.some(m => m.id === msgId)
            if (!hasMsg) return c
            const newTranslations = { ...(c.messages.find(m => m.id === msgId)?.translations ?? {}), [targetLang]: data.translated }
            if (isLoggedIn) dbUpdateMessageTranslation(c.id, msgId, newTranslations, targetLang)
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === msgId
                  ? { ...m, translations: newTranslations, activeLang: targetLang }
                  : m
              ),
            }
          })
          if (!isLoggedIn) saveChats(updated)
          return updated
        })
      }
    } catch {
      // Translation failed — fall back to EN silently
      setChats(prev => {
        const updated = prev.map(c => ({
          ...c,
          messages: c.messages.map(m => m.id === msgId ? { ...m, activeLang: 'en' as const } : m),
        }))
        saveChats(updated)
        return updated
      })
    } finally {
      setTranslatingIds(prev => {
        const next = new Set(prev)
        next.delete(msgId)
        return next
      })
    }
  }

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = chats.filter(c => c.id !== id)
    updateChats(updated)
    if (currentChatId === id) setCurrentChatId(null)
    if (isLoggedIn) dbDeleteChat(id)
  }

  const langOptions = [
    { code: 'en' as const, label: 'EN' },
    { code: 'gu' as const, label: 'GU' },
    { code: 'hi' as const, label: 'HI' },
  ]

  const groups = groupChatsByDate(chats)

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* Sidebar */}
      <aside
        className={`
          flex flex-col shrink-0 border-r border-border bg-secondary/30
          transition-all duration-300 overflow-hidden
          ${sidebarOpen ? 'w-64' : 'w-0'}
        `}
      >
        <div className="w-64 flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-3 py-3 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Chats
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewChat}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 pt-2">No chats yet</p>
            ) : (
              groups.map(group => (
                <div key={group.label}>
                  <p className="text-xs text-muted-foreground font-medium px-2 mb-1">
                    {group.label}
                  </p>
                  {group.chats.map(chat => (
                    <div
                      key={chat.id}
                      onClick={() => { setCurrentChatId(chat.id); setExpandedSources(new Set()) }}
                      className={`
                        group flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer
                        text-sm truncate transition-colors
                        ${currentChatId === chat.id
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                        }
                      `}
                    >
                      <span className="truncate flex-1 text-xs">{chat.title}</span>
                      <button
                        onClick={(e) => deleteChat(chat.id, e)}
                        className="shrink-0 ml-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(v => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              <PanelLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewChat}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-5 h-5" />
            </Button>
            <span className="font-medium text-foreground text-sm hidden sm:block">{t.nav.title}</span>
          </div>

          {/* User menu */}
          <div className="relative">
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-secondary transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-foreground/10 border border-border flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground hidden sm:block max-w-[140px] truncate">
                    {session?.user?.email}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                      <div className="px-3 py-2.5 border-b border-border">
                        <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                      </div>
                      <button
                        onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: '/' }) }}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <Link
                href="/auth/login"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-secondary transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in
              </Link>
            )}
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="max-w-2xl w-full text-center">
                <h2 className="text-2xl font-semibold text-foreground mb-2">{t.nav.title}</h2>
                <p className="text-muted-foreground text-sm mb-8">{t.chat.placeholder}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {t.suggestions.questions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(q)}
                      className="px-4 py-2 text-sm text-muted-foreground bg-secondary hover:bg-secondary/70 rounded-xl border border-border transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'error' ? (
                    <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                      <span className="mt-0.5">⚠</span>
                      <p className="leading-relaxed">{message.content}</p>
                    </div>
                  ) : message.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[75%] bg-secondary rounded-3xl px-5 py-3">
                        <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        prose-headings:font-semibold prose-headings:text-foreground
                        prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                        prose-p:text-foreground prose-p:leading-7
                        prose-strong:text-foreground prose-strong:font-semibold
                        prose-li:text-foreground prose-li:leading-7
                        prose-ol:my-2 prose-ul:my-2
                        prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded
                        prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {(() => {
                            const lang = message.activeLang ?? 'en'
                            if (lang === 'gu') return message.translations?.gu ?? message.content
                            if (lang === 'hi') return message.translations?.hi ?? message.content
                            return message.content
                          })()}
                        </ReactMarkdown>
                      </div>

                      {/* Per-message language toggle */}
                      <div className="flex items-center gap-1 mt-2">
                        {langOptions.map(l => {
                          const isActive = (message.activeLang ?? 'en') === l.code
                          const isLoading = translatingIds.has(message.id) && (message.activeLang ?? 'en') === l.code
                          return (
                            <button
                              key={l.code}
                              onClick={() => handleTranslate(message.id, l.code)}
                              disabled={translatingIds.has(message.id)}
                              className={`px-2.5 py-0.5 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                                isActive
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'border-border text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {isLoading ? '···' : l.label}
                            </button>
                          )
                        })}
                      </div>

                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleSource(message.id)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>View all sources ({message.sources.length})</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedSources.has(message.id) ? 'rotate-180' : ''}`} />
                          </button>

                          {expandedSources.has(message.id) && (
                            <div className="mt-3 border-l-2 border-border pl-4 space-y-4">
                              {message.sources.map((src, i) => (
                                <div key={i}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-foreground">
                                      {src.book} · {src.reference}{src.title ? ` — ${src.title}` : ''}
                                    </span>
                                    <button
                                      onClick={() => openFullSource(src)}
                                      className="ml-2 shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Read full
                                    </button>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed italic">
                                    "{src.text}"
                                  </p>
                                  {i < message.sources!.length - 1 && (
                                    <div className="mt-4 border-t border-border/40" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:300ms]" />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input */}
        <div className="shrink-0 px-4 pb-3 pt-2">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 bg-secondary rounded-2xl border border-border px-4 py-2 shadow-lg shadow-black/10">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.chat.placeholder}
                rows={1}
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-sm leading-6"
                style={{ minHeight: '24px', maxHeight: '160px' }}
              />
              <Button
                onClick={() => handleSubmit()}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="bg-foreground hover:bg-foreground/80 text-background rounded-lg h-8 w-8 shrink-0 disabled:opacity-25 transition-opacity"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground/50 mt-2">
              {t.footer.disclaimer}
            </p>
          </div>
        </div>

      </div>
      {/* Full Source Modal */}
      {(loadingSource || fullSource) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => { setFullSource(null); setPendingSourceRef(null) }}>
          <div
            className="relative bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex-1 min-w-0">
                {fullSource && (
                  <>
                    <p className="text-xs text-muted-foreground mb-0.5">{fullSource.book}</p>
                    <h3 className="text-base font-semibold text-foreground">
                      {fullSource.title ?? `Prakaran ${fullSource.prakaran}, Verse ${fullSource.verse_no}`}
                    </h3>
                    {fullSource.place && (
                      <p className="text-xs text-muted-foreground mt-0.5">{fullSource.place}</p>
                    )}
                  </>
                )}
                {loadingSource && <p className="text-sm text-muted-foreground">Loading...</p>}

                {/* Language toggle */}
                {pendingSourceRef && (
                  <div className="flex items-center gap-1 mt-3">
                    {[
                      { code: 'english', label: 'EN' },
                      { code: 'gujarati', label: 'GU' },
                      { code: 'hindi', label: 'HI' },
                    ].map(l => (
                      <button
                        key={l.code}
                        onClick={() => {
                          setSourceLanguage(l.code)
                          fetchSource(pendingSourceRef, l.code)
                        }}
                        className={`px-2.5 py-0.5 text-xs rounded-md border transition-colors ${
                          sourceLanguage === l.code
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => { setFullSource(null); setPendingSourceRef(null) }}
                className="ml-4 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto px-6 py-5">
              {loadingSource && <p className="text-sm text-muted-foreground">Loading...</p>}
              {!loadingSource && fullSource && renderSourceText(fullSource.text)}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
