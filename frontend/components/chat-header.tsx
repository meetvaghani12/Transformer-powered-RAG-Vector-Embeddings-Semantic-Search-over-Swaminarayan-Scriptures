"use client"

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useLanguage } from '@/lib/language-context'
import { Button } from '@/components/ui/button'
import { Plus, PanelLeft, ChevronDown, LogIn, LogOut, Sun, Moon } from 'lucide-react'
import Link from 'next/link'
import type { Chat } from '@/lib/chat-types'
import { ChatExport } from '@/components/chat-export'

interface ChatHeaderProps {
  onToggleSidebar: () => void
  onNewChat: () => void
  currentChat?: Chat | null
}

export function ChatHeader({ onToggleSidebar, onNewChat, currentChat }: ChatHeaderProps) {
  const { t } = useLanguage()
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.id
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="text-muted-foreground hover:text-foreground"
        >
          <PanelLeft className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-5 h-5" />
        </Button>
        <span className="font-medium text-foreground text-sm hidden sm:block">{t.nav.title}</span>
        <ChatExport chat={currentChat ?? null} />
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle — only render after mount to avoid hydration mismatch */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="text-muted-foreground hover:text-foreground h-8 w-8"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        )}

      {/* User menu */}
      <div className="relative">
        {isLoggedIn ? (
          <>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-secondary transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-foreground/10 border border-border flex items-center justify-center">
                <span className="text-xs font-semibold text-foreground">
                  {(session?.user?.email?.split('@')[0]?.[0] ?? '?').toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-muted-foreground hidden sm:block max-w-[140px] truncate">
                {session?.user?.email?.split('@')[0]}
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
      </div>
    </header>
  )
}
