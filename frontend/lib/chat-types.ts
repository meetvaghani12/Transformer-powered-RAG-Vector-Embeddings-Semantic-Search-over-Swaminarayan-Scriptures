export interface Source {
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

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  sources?: Source[]
  translations?: { gu?: string; hi?: string }
  activeLang?: 'en' | 'gu' | 'hi'
  suggestions?: string[]
}

export interface FullSource {
  book: string
  title?: string
  place?: string
  loc?: string
  vachno?: string
  prakaran?: string
  verse_no?: string
  text: string
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  summary: string
  createdAt: number
}
