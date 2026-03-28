'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  pendingActions?: Array<{ type: string; payload: Record<string, unknown>; description: string }>
  actionsApplied?: string[]
  routedVia?: 'local' | 'openai' | 'gemini' | 'gemini-api-key' | 'claude'
}

interface AgentChatState {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  clearMessages: () => void
  /** Message pre-seeded from outside (e.g. home page prompt bar) to auto-send when the agent opens */
  pendingInput: string
  setPendingInput: (text: string) => void
}

const AgentChatContext = createContext<AgentChatState>({
  messages: [],
  setMessages: () => {},
  clearMessages: () => {},
  pendingInput: '',
  setPendingInput: () => {},
})

export function AgentChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [pendingInput, setPendingInput] = useState('')

  const clearMessages = useCallback(() => setMessages([]), [])

  return (
    <AgentChatContext.Provider value={{ messages, setMessages, clearMessages, pendingInput, setPendingInput }}>
      {children}
    </AgentChatContext.Provider>
  )
}

export function useAgentChat() {
  return useContext(AgentChatContext)
}

export type { Message }
