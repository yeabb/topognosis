import { useState } from 'react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import Sidebar from '../components/Sidebar'
import ChatPanel from '../components/ChatPanel'
import GraphPanel from '../components/GraphPanel'
import client from '../api/client'
import type { Graph, Message } from '../types'

export default function AppShell() {
  const [activeGraph, setActiveGraph] = useState<Graph | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarKey, setSidebarKey] = useState(0) // used to refresh sidebar graph list

  function handleSelectGraph(graph: Graph) {
    setActiveGraph(graph)
    setMessages([])
  }

  async function handleNewGraph() {
    const res = await client.post<Graph>('/graphs/', { name: 'New graph' })
    setActiveGraph(res.data)
    setMessages([])
    setSidebarKey((k) => k + 1)
  }

  async function handleSend(content: string) {
    if (!activeGraph) {
      // Auto-create a graph if none is active
      const res = await client.post<Graph>('/graphs/', { name: 'New graph' })
      setActiveGraph(res.data)
      setSidebarKey((k) => k + 1)
      sendMessage(res.data.id, content)
      return
    }
    sendMessage(activeGraph.id, content)
  }

  async function sendMessage(graphId: string, content: string) {
    const userMessage: Message = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setChatLoading(true)

    let assistantContent = ''
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`/api/graphs/${graphId}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: content }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          const data = JSON.parse(line.slice(6))

          if (data.error) {
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.' }
              return updated
            })
            break
          }

          if (data.text) {
            assistantContent += data.text
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
              return updated
            })
          }

          if (data.done && data.graph_name) {
            setActiveGraph((prev) => prev ? { ...prev, name: data.graph_name } : prev)
            setSidebarKey((k) => k + 1)
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.' }
        return updated
      })
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f0f0f]">
      {/* Sidebar */}
      <div
        className={`flex-shrink-0 transition-all duration-300 overflow-hidden ${
          sidebarCollapsed ? 'w-0' : 'w-[260px]'
        }`}
      >
        <Sidebar
          key={sidebarKey}
          activeGraphId={activeGraph?.id ?? null}
          onSelectGraph={handleSelectGraph}
          onNewGraph={handleNewGraph}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-3 left-3 z-10 w-7 h-7 flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.07] transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {sidebarCollapsed ? (
              <path d="M13 4l7 8-7 8M4 4l7 8-7 8" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M11 4l-7 8 7 8M20 4l-7 8 7 8" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>

        <PanelGroup direction="horizontal" className="flex-1">
          <Panel defaultSize={60} minSize={30}>
            <ChatPanel
              activeGraph={activeGraph}
              messages={messages}
              onSend={handleSend}
              loading={chatLoading}
            />
          </Panel>

          <PanelResizeHandle className="w-[1px] bg-white/[0.08] hover:bg-indigo-500/60 hover:w-[2px] transition-all cursor-col-resize" />

          <Panel defaultSize={40} minSize={20}>
            <GraphPanel />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
