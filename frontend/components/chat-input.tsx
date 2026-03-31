"use client"

import { useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/language-context'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

interface ChatInputProps {
  input: string
  isLoading: boolean
  onInputChange: (value: string) => void
  onSubmit: () => void
}

export function ChatInput({ input, isLoading, onInputChange, onSubmit }: ChatInputProps) {
  const { t } = useLanguage()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="shrink-0 px-4 pb-3 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 bg-secondary rounded-2xl border border-border px-4 py-2 shadow-lg shadow-black/10">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.chat.placeholder}
            rows={1}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-sm leading-6"
            style={{ minHeight: '24px', maxHeight: '160px' }}
          />
          <Button
            onClick={onSubmit}
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
  )
}
