import { useReducer } from 'react'
import type { Chat, Message, Source, FullSource } from '@/lib/chat-types'

// ── State ────────────────────────────────────────────────────────────────────

export interface ChatState {
  chats: Chat[]
  currentChatId: string | null
  input: string
  isLoading: boolean
  expandedSources: Set<string>
  translatingIds: Set<string>
  sidebarOpen: boolean
  fullSource: FullSource | null
  loadingSource: boolean
  sourceLanguage: string
  pendingSourceRef: Source | null
}

export const initialChatState: ChatState = {
  chats: [],
  currentChatId: null,
  input: '',
  isLoading: false,
  expandedSources: new Set(),
  translatingIds: new Set(),
  sidebarOpen: false,
  fullSource: null,
  loadingSource: false,
  sourceLanguage: 'english',
  pendingSourceRef: null,
}

// ── Actions ──────────────────────────────────────────────────────────────────

type ChatAction =
  | { type: 'SET_CHATS'; chats: Chat[] }
  | { type: 'SET_CURRENT_CHAT'; id: string | null }
  | { type: 'SET_INPUT'; value: string }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'SET_SIDEBAR'; open: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_SOURCE'; id: string }
  | { type: 'ADD_TRANSLATING'; id: string }
  | { type: 'REMOVE_TRANSLATING'; id: string }
  | { type: 'SET_FULL_SOURCE'; source: FullSource | null }
  | { type: 'SET_LOADING_SOURCE'; value: boolean }
  | { type: 'SET_SOURCE_LANGUAGE'; lang: string }
  | { type: 'SET_PENDING_SOURCE_REF'; ref: Source | null }
  | { type: 'NEW_CHAT' }
  | { type: 'SELECT_CHAT'; id: string }
  | { type: 'DELETE_CHAT'; id: string }
  | { type: 'UPDATE_CHATS'; chats: Chat[] }
  | { type: 'UPDATE_MESSAGE'; chatId: string; messageId: string; updates: Partial<Message> }
  | { type: 'ADD_MESSAGE'; chatId: string; message: Message }
  | { type: 'UPDATE_CHAT_SUMMARY'; chatId: string; summary: string }
  | { type: 'OPEN_SOURCE_MODAL'; src: Source }
  | { type: 'CLOSE_SOURCE_MODAL' }

// ── Reducer ──────────────────────────────────────────────────────────────────

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CHATS':
      return { ...state, chats: action.chats }

    case 'SET_CURRENT_CHAT':
      return { ...state, currentChatId: action.id }

    case 'SET_INPUT':
      return { ...state, input: action.value }

    case 'SET_LOADING':
      return { ...state, isLoading: action.value }

    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.open }

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen }

    case 'TOGGLE_SOURCE': {
      const next = new Set(state.expandedSources)
      next.has(action.id) ? next.delete(action.id) : next.add(action.id)
      return { ...state, expandedSources: next }
    }

    case 'ADD_TRANSLATING': {
      const next = new Set(state.translatingIds)
      next.add(action.id)
      return { ...state, translatingIds: next }
    }

    case 'REMOVE_TRANSLATING': {
      const next = new Set(state.translatingIds)
      next.delete(action.id)
      return { ...state, translatingIds: next }
    }

    case 'SET_FULL_SOURCE':
      return { ...state, fullSource: action.source }

    case 'SET_LOADING_SOURCE':
      return { ...state, loadingSource: action.value }

    case 'SET_SOURCE_LANGUAGE':
      return { ...state, sourceLanguage: action.lang }

    case 'SET_PENDING_SOURCE_REF':
      return { ...state, pendingSourceRef: action.ref }

    case 'NEW_CHAT':
      return { ...state, currentChatId: null, expandedSources: new Set() }

    case 'SELECT_CHAT':
      return { ...state, currentChatId: action.id, expandedSources: new Set(), sidebarOpen: false }

    case 'DELETE_CHAT': {
      const chats = state.chats.filter(c => c.id !== action.id)
      const currentChatId = state.currentChatId === action.id ? null : state.currentChatId
      return { ...state, chats, currentChatId }
    }

    case 'UPDATE_CHATS':
      return { ...state, chats: action.chats }

    case 'ADD_MESSAGE':
      return {
        ...state,
        chats: state.chats.map(c =>
          c.id === action.chatId
            ? { ...c, messages: [...c.messages, action.message] }
            : c
        ),
      }

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        chats: state.chats.map(c =>
          c.id === action.chatId
            ? {
                ...c,
                messages: c.messages.map(m =>
                  m.id === action.messageId ? { ...m, ...action.updates } : m
                ),
              }
            : c
        ),
      }

    case 'UPDATE_CHAT_SUMMARY':
      return {
        ...state,
        chats: state.chats.map(c =>
          c.id === action.chatId ? { ...c, summary: action.summary } : c
        ),
      }

    case 'OPEN_SOURCE_MODAL':
      return { ...state, sourceLanguage: 'english', pendingSourceRef: action.src }

    case 'CLOSE_SOURCE_MODAL':
      return { ...state, fullSource: null, pendingSourceRef: null }

    default:
      return state
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChatState() {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)
  return { state, dispatch }
}
