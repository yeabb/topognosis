import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import ChatPanel from '../components/ChatPanel'
import GraphPanel from '../components/GraphPanel'
import type { Graph, Message } from '../types'

export default function AppShell() {
  const [activeGraph, setActiveGraph] = useState<Graph | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  function handleSelectGraph(graph: Graph) {
    setActiveGraph(graph)
    setMessages([])
  }

  function handleNewGraph() {
    setActiveGraph(null)
    setMessages([])
  }

  function handleSend(content: string) {
    const userMessage: Message = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setChatLoading(true)

    // TODO: wire to API in next task
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '(API not wired yet — coming next task)' },
      ])
      setChatLoading(false)
    }, 800)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f0f0f]">
      <Sidebar
        activeGraphId={activeGraph?.id ?? null}
        onSelectGraph={handleSelectGraph}
        onNewGraph={handleNewGraph}
      />
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ChatPanel messages={messages} onSend={handleSend} loading={chatLoading} />
        </div>
        <div className="w-[380px] shrink-0 overflow-hidden">
          <GraphPanel />
        </div>
      </main>
    </div>
  )
}
