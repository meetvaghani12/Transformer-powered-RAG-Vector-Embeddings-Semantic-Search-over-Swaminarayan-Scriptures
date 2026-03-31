"use client"

import { Button } from '@/components/ui/button'
import { Plus, Trash2, X } from 'lucide-react'
import type { Chat } from '@/lib/chat-types'
import { groupChatsByDate } from '@/lib/chat-storage'

interface ChatSidebarProps {
  chats: Chat[]
  currentChatId: string | null
  sidebarOpen: boolean
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat: (id: string, e: React.MouseEvent) => void
  onCloseSidebar: () => void
}

export function ChatSidebar({
  chats, currentChatId, sidebarOpen,
  onSelectChat, onNewChat, onDeleteChat, onCloseSidebar,
}: ChatSidebarProps) {
  const groups = groupChatsByDate(chats)

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={onCloseSidebar}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-background
          w-full sm:w-80
          md:relative md:z-auto md:inset-auto md:bg-secondary/30 md:shrink-0 md:w-64
          transition-all duration-300
          ${sidebarOpen
            ? 'translate-x-0 md:overflow-visible'
            : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'
          }
        `}
      >
        <div className="flex flex-col h-full w-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-3 py-3 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Chats
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onNewChat}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCloseSidebar}
                className="h-7 w-7 text-muted-foreground hover:text-foreground md:hidden"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
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
                      onClick={() => onSelectChat(chat.id)}
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
                        onClick={(e) => onDeleteChat(chat.id, e)}
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
    </>
  )
}
