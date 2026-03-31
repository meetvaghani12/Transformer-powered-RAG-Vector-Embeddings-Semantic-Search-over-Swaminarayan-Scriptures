"use client"

import { X } from 'lucide-react'
import type { FullSource, Source } from '@/lib/chat-types'

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

interface SourceModalProps {
  fullSource: FullSource | null
  loadingSource: boolean
  pendingSourceRef: Source | null
  sourceLanguage: string
  onChangeLanguage: (lang: string) => void
  onClose: () => void
}

export function SourceModal({
  fullSource, loadingSource, pendingSourceRef,
  sourceLanguage, onChangeLanguage, onClose,
}: SourceModalProps) {
  if (!loadingSource && !fullSource) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
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
                    onClick={() => onChangeLanguage(l.code)}
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
            onClick={onClose}
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
  )
}
