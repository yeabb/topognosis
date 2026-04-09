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

  async function handleSelectGraph(graph: Graph) {
    setActiveGraph(graph)
    setMessages([])
    try {
      const res = await client.get<{ materialized_context: Message[] }[]>(`/nodes/?graph=${graph.id}`)
      const nodes = res.data
      if (nodes.length > 0) {
        setMessages(nodes[0].materialized_context)
      }
    } catch {
      // silently fail — empty chat is fine
    }
  }

  async function handleNewGraph() {
    const res = await client.post<Graph>('/graphs/', { name: 'New graph' })
    setActiveGraph(res.data)
    setMessages([])
    setSidebarKey((k) => k + 1)
  }

  async function handleSend(content: string, model: string) {
    if (!activeGraph) {
      // Auto-create a graph if none is active
      const res = await client.post<Graph>('/graphs/', { name: 'New graph' })
      setActiveGraph(res.data)
      setSidebarKey((k) => k + 1)
      sendMessage(res.data.id, content, model)
      return
    }
    sendMessage(activeGraph.id, content, model)
  }

  async function sendMessage(graphId: string, content: string, model: string) {
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
        body: JSON.stringify({ message: content, model }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.error) {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: data.error }
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
          } catch {
            // Incomplete JSON chunk — skip
          }
        }
      }
    } catch (e) {
      console.error('Chat stream failed', e)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Connection failed. Please check your internet and try again.' }
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
