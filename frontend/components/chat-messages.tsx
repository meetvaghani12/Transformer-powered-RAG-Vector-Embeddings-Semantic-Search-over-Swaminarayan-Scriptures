"use client"

import { useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/language-context'
import { BookOpen, ChevronDown, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message, Source } from '@/lib/chat-types'
import { ThinkingIndicator } from '@/components/thinking-indicator'

// Citation patterns — English + Gujarati + Hindi variants
// Vachnamrut: "Vachnamrut GI-28", "વચનામૃત GI-28", "वचनामृत GI-28"
// Swamini Vato: "Swamini Vato Prakaran 5, Verse 269", "સ્વામિની વાતો પ્રકરણ 5, શ્લોક 269", "स्वामिनी वातो प्रकरण 5, श्लोक 269"
const CITATION_PATTERN = new RegExp(
  // Group 1-3: Vachnamrut (EN/GU/HI) — captures loc + vachno
  '(?:Vachnamrut|Vachanamrut|વચનામૃત|वचनामृत)\\s+([A-Z]+)[-–]?(\\d+)' +
  '|' +
  // Group 3-4: Swamini Vato (EN/GU/HI) — captures prakaran + verse
  '(?:Swamini\\s+Vato|સ્વામિની\\s+વાતો|स्वामिनी\\s+वातो)\\s+' +
  '(?:Prakaran|પ્રકરણ|प्रकरण)\\s+(\\d+)[,،]?\\s*' +
  '(?:Verse|શ્લોક|श्लोक)\\s+(\\d+)',
  'g'
)

function CitationText({ text, onCitationClick }: {
  text: string
  onCitationClick: (src: Source) => void
}) {
  const parts: { type: 'text' | 'vach' | 'vato'; value: string; loc?: string; vachno?: string; prakaran?: string; verse_no?: string }[] = []
  let lastIndex = 0

  // Reset regex state
  CITATION_PATTERN.lastIndex = 0

  let match
  while ((match = CITATION_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      // Vachnamrut match — group 1=loc, 2=vachno
      parts.push({ type: 'vach', value: match[0], loc: match[1], vachno: match[2] })
    } else if (match[3] !== undefined) {
      // Swamini Vato match — group 3=prakaran, 4=verse
      parts.push({ type: 'vato', value: match[0], prakaran: match[3], verse_no: match[4] })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  if (parts.length === 0 || (parts.length === 1 && parts[0].type === 'text')) {
    return <>{text}</>
  }

  return (
    <>
      {parts.map((p, i) => {
        if (p.type === 'vach') {
          return (
            <button
              key={i}
              onClick={() => onCitationClick({
                book: 'Vachnamrut', reference: `${p.loc}-${p.vachno}`,
                loc: p.loc, vachno: p.vachno, text: '', score: 0,
              })}
              className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary cursor-pointer font-medium"
            >
              {p.value}
            </button>
          )
        }
        if (p.type === 'vato') {
          return (
            <button
              key={i}
              onClick={() => onCitationClick({
                book: 'Swamini Vato', reference: `Prakaran ${p.prakaran}, Verse ${p.verse_no}`,
                prakaran: p.prakaran, verse_no: p.verse_no, text: '', score: 0,
              })}
              className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary cursor-pointer font-medium"
            >
              {p.value}
            </button>
          )
        }
        return <span key={i}>{p.value}</span>
      })}
    </>
  )
}

const LANG_OPTIONS = [
  { code: 'en' as const, label: 'EN' },
  { code: 'gu' as const, label: 'GU' },
  { code: 'hi' as const, label: 'HI' },
]

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
  expandedSources: Set<string>
  translatingIds: Set<string>
  onToggleSource: (id: string) => void
  onOpenFullSource: (src: Source) => void
  onTranslate: (msgId: string, lang: 'en' | 'gu' | 'hi') => void
  onSubmitQuestion: (question: string) => void
}

export function ChatMessages({
  messages, isLoading, expandedSources, translatingIds,
  onToggleSource, onOpenFullSource, onTranslate, onSubmitQuestion,
}: ChatMessagesProps) {
  const { t } = useLanguage()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0) {
    return (
      <main className="flex-1 overflow-y-auto">
        <div className="h-full flex flex-col items-center justify-center px-4">
          <div className="max-w-2xl w-full text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-2">{t.nav.title}</h2>
            <p className="text-muted-foreground text-sm mb-8">{t.chat.placeholder}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {t.suggestions.questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onSubmitQuestion(q)}
                  className="px-4 py-2 text-sm text-muted-foreground bg-secondary hover:bg-secondary/70 rounded-xl border border-border transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto">
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
            ) : (() => {
              const isStreaming = isLoading && message.content && messages[messages.length - 1]?.id === message.id
              return (
              <div>
                <div className={`prose prose-sm dark:prose-invert max-w-none
                  prose-headings:font-semibold prose-headings:text-foreground
                  prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                  prose-p:text-foreground prose-p:leading-7
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-li:text-foreground prose-li:leading-7
                  prose-ol:my-2 prose-ul:my-2
                  prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded
                  prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
                  ${isStreaming ? 'streaming-cursor' : ''}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p>
                          {typeof children === 'string'
                            ? <CitationText text={children} onCitationClick={onOpenFullSource} />
                            : Array.isArray(children)
                              ? children.map((child, i) =>
                                  typeof child === 'string'
                                    ? <CitationText key={i} text={child} onCitationClick={onOpenFullSource} />
                                    : child
                                )
                              : children
                          }
                        </p>
                      ),
                      li: ({ children }) => (
                        <li>
                          {typeof children === 'string'
                            ? <CitationText text={children} onCitationClick={onOpenFullSource} />
                            : Array.isArray(children)
                              ? children.map((child, i) =>
                                  typeof child === 'string'
                                    ? <CitationText key={i} text={child} onCitationClick={onOpenFullSource} />
                                    : child
                                )
                              : children
                          }
                        </li>
                      ),
                    }}
                  >
                    {(() => {
                      const lang = message.activeLang ?? 'en'
                      if (lang === 'gu') return message.translations?.gu ?? message.content
                      if (lang === 'hi') return message.translations?.hi ?? message.content
                      return message.content
                    })()}
                  </ReactMarkdown>
                </div>

                {/* Follow-up suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {message.suggestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => onSubmitQuestion(q)}
                        disabled={isLoading}
                        className="text-xs text-muted-foreground border border-border rounded-xl px-3 py-1.5 hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-40 text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Sources row + language toggle */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onToggleSource(message.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>View all sources ({message.sources.length})</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedSources.has(message.id) ? 'rotate-180' : ''}`} />
                      </button>

                      <div className="flex items-center gap-1">
                        {LANG_OPTIONS.map(l => {
                          const isActive = (message.activeLang ?? 'en') === l.code
                          const isTranslating = translatingIds.has(message.id) && (message.activeLang ?? 'en') === l.code
                          return (
                            <button
                              key={l.code}
                              onClick={() => onTranslate(message.id, l.code)}
                              disabled={translatingIds.has(message.id)}
                              className={`px-2.5 py-0.5 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                                isActive
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'border-border text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {isTranslating ? '···' : l.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {expandedSources.has(message.id) && (
                      <div className="mt-3 border-l-2 border-border pl-4 space-y-4">
                        {message.sources.map((src, i) => (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-foreground">
                                {src.book} · {src.reference}{src.title ? ` — ${src.title}` : ''}
                              </span>
                              <button
                                onClick={() => onOpenFullSource(src)}
                                className="ml-2 shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Read full
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed italic">
                              &quot;{src.text}&quot;
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

                {/* Language toggle alone — only when there are no sources and message has content */}
                {(!message.sources || message.sources.length === 0) && message.content && (
                  <div className="flex items-center gap-1 mt-3">
                    {LANG_OPTIONS.map(l => {
                      const isActive = (message.activeLang ?? 'en') === l.code
                      const isTranslating = translatingIds.has(message.id) && (message.activeLang ?? 'en') === l.code
                      return (
                        <button
                          key={l.code}
                          onClick={() => onTranslate(message.id, l.code)}
                          disabled={translatingIds.has(message.id)}
                          className={`px-2.5 py-0.5 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                            isActive
                              ? 'bg-foreground text-background border-foreground'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {isTranslating ? '···' : l.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )})()}
          </div>
        ))}

        {isLoading && (!messages.some(m => m.role === 'assistant' && m.content !== '') || messages[messages.length - 1]?.content === '') && (
          <ThinkingIndicator />
        )}

        <div ref={messagesEndRef} />
      </div>
    </main>
  )
}
