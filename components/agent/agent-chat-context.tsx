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
}

const AgentChatContext = createContext<AgentChatState>({
  messages: [],
  setMessages: () => {},
  clearMessages: () => {},
})

export function AgentChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])

  const clearMessages = useCallback(() => setMessages([]), [])

  return (
    <AgentChatContext.Provider value={{ messages, setMessages, clearMessages }}>
      {children}
    </AgentChatContext.Provider>
  )
}

export function useAgentChat() {
  return useContext(AgentChatContext)
}

export type { Message }
