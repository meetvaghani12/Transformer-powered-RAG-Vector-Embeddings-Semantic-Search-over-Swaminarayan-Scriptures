"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/lib/language-context'
import { ChevronDown, BookOpen } from 'lucide-react'

interface Source {
  book: string
  reference: string
  title?: string
  text: string
  score: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useLanguage()
  const [showSources, setShowSources] = useState(false)
  const isUser = message.role === 'user'
  const hasSources = !isUser && message.sources && message.sources.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? 'order-2' : 'order-1'}`}>

        {/* Message Bubble */}
        <div className={`
          rounded-xl px-4 py-3
          ${isUser
            ? 'bg-primary text-background rounded-br-sm'
            : 'bg-secondary rounded-bl-sm text-foreground'
          }
        `}>
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>

        {/* View all sources toggle */}
        {hasSources && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-2"
          >
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-primary text-xs transition-colors duration-200"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>View all sources ({message.sources!.length})</span>
              <motion.div
                animate={{ rotate: showSources ? 180 : 0 }}
                transition={{ duration: 0.25 }}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.div>
            </button>

            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 border-l-2 border-border pl-3 space-y-4">
                    {message.sources!.map((src, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">
                            {src.book} · {src.reference}
                            {src.title ? ` — ${src.title}` : ''}
                          </span>
                          <span className="text-xs text-primary ml-2 shrink-0">
                            {Math.round(src.score * 100)}% match
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed italic">
                          "{src.text}"
                        </p>
                        {i < message.sources!.length - 1 && (
                          <div className="mt-4 border-t border-border/50" />
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

      </div>
    </motion.div>
  )
}
