import { useState } from 'react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import Sidebar from '../components/Sidebar'
import ChatPanel from '../components/ChatPanel'
import GraphPanel from '../components/GraphPanel'
import client from '../api/client'
import type { Graph, Message, Node } from '../types/index'

export default function AppShell() {
  const [activeGraph, setActiveGraph] = useState<Graph | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [activeNode, setActiveNode] = useState<Node | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarKey, setSidebarKey] = useState(0)

  async function fetchNodes(graphId: string): Promise<Node[]> {
    const res = await client.get<Node[]>(`/nodes/?graph=${graphId}`)
    return res.data
  }

  async function handleSelectGraph(graph: Graph) {
    setActiveGraph(graph)
    setMessages([])
    setNodes([])
    setActiveNode(null)
    try {
      const fetched = await fetchNodes(graph.id)
      setNodes(fetched)
      if (fetched.length > 0) {
        const active = fetched.find((n) => n.status === 'active') ?? fetched[fetched.length - 1]
        setMessages(active.materialized_context)
        setActiveNode(active)
      }
    } catch {
      // silently fail — empty graph is fine
    }
  }

  async function handleNewGraph() {
    const res = await client.post<Graph>('/graphs/', { name: 'New graph' })
    setActiveGraph(res.data)
    setMessages([])
    setNodes([])
    setActiveNode(null)
    setSidebarKey((k) => k + 1)
  }

  function handleSelectNode(node: Node) {
    setActiveNode(node)
    setMessages(node.materialized_context)
  }

  async function handleBranch(messageIndex: number) {
    if (!activeNode) return
    try {
      const res = await client.post<Node>(`/nodes/${activeNode.id}/branch/`, {
        branch_from_index: messageIndex,
      })
      const newNode = res.data
      // Add to local node list and switch to it
      setNodes((prev) => [...prev, newNode])
      setActiveNode(newNode)
      setMessages(newNode.materialized_context)
    } catch (e) {
      console.error('Branch failed', e)
    }
  }

  async function handleBranchFromNode(node: Node) {
    // Branch from the tip of the node (last message index)
    if (node.materialized_context.length === 0) return
    const lastIndex = node.materialized_context.length - 1
    // First switch to that node so context is correct
    setActiveNode(node)
    setMessages(node.materialized_context)
    try {
      const res = await client.post<Node>(`/nodes/${node.id}/branch/`, {
        branch_from_index: lastIndex,
      })
      const newNode = res.data
      setNodes((prev) => [...prev, newNode])
      setActiveNode(newNode)
      setMessages(newNode.materialized_context)
    } catch (e) {
      console.error('Branch from node failed', e)
    }
  }

  async function handleSend(content: string, model: string) {
    if (!activeGraph) {
      const res = await client.post<Graph>('/graphs/', { name: 'New graph' })
      setActiveGraph(res.data)
      setSidebarKey((k) => k + 1)
      sendMessage(res.data.id, content, model, null)
      return
    }
    sendMessage(activeGraph.id, content, model, activeNode?.id ?? null)
  }

  async function sendMessage(graphId: string, content: string, model: string, nodeId: string | null) {
    const userMessage: Message = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setChatLoading(true)

    let assistantContent = ''
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const token = localStorage.getItem('access_token')
      const body: Record<string, string> = { message: content, model }
      if (nodeId) body.node_id = nodeId

      const response = await fetch(`/api/graphs/${graphId}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
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

            if (data.done) {
              if (data.graph_name) {
                setActiveGraph((prev) => prev ? { ...prev, name: data.graph_name } : prev)
                setSidebarKey((k) => k + 1)
              }
              // Refresh nodes so graph panel updates
              try {
                const fetched = await fetchNodes(graphId)
                setNodes(fetched)
                if (data.node_id) {
                  const updatedNode = fetched.find((n) => n.id === data.node_id)
                  if (updatedNode) setActiveNode(updatedNode)
                }
              } catch {
                // non-critical
              }
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
              inheritedContextLength={activeNode?.inherited_context_length ?? 0}
              onSend={handleSend}
              onBranch={handleBranch}
              loading={chatLoading}
            />
          </Panel>

          <PanelResizeHandle className="w-[1px] bg-white/[0.08] hover:bg-indigo-500/60 hover:w-[2px] transition-all cursor-col-resize" />

          <Panel defaultSize={40} minSize={20}>
            <GraphPanel
              nodes={nodes}
              activeNodeId={activeNode?.id ?? null}
              loading={chatLoading}
              onSelectNode={handleSelectNode}
              onBranchFromNode={handleBranchFromNode}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
