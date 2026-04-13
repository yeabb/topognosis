import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import GraphPanel from '../components/GraphPanel'
import NodeDetailPanel from '../components/NodeDetailPanel'
import client from '../api/client'
import type { Graph, Node, Message } from '../types/index'

interface LiveEvent {
  type: string
  text?: string
  node_id?: string
}

const WS_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000')
  .replace(/^https/, 'wss')
  .replace(/^http/, 'ws')

export default function GraphPage() {
  const { graphId } = useParams<{ graphId: string }>()
  const [graph, setGraph] = useState<Graph | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [liveMessages, setLiveMessages] = useState<Message[]>([])
  const [connected, setConnected] = useState(false)

  // Initial load
  useEffect(() => {
    if (!graphId) return

    client.get<Graph>(`/graphs/${graphId}/`).then((r) => setGraph(r.data)).catch(() => {})

    client.get<Node[]>(`/nodes/?graph=${graphId}`).then((r) => {
      setNodes(r.data)
      const active = r.data.find((n) => n.status === 'active') ?? r.data[r.data.length - 1]
      if (active) {
        setActiveNodeId(active.id)
        setSelectedNodeId((prev) => prev ?? active.id)
      }
    }).catch(() => {})
  }, [graphId])

  // WebSocket connection
  useEffect(() => {
    if (!graphId) return
    const token = localStorage.getItem('access_token')
    if (!token) return

    const ws = new WebSocket(`${WS_BASE}/ws/graphs/${graphId}/?token=${token}`)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    ws.onmessage = (e) => {
      let event: LiveEvent
      try {
        event = JSON.parse(e.data)
      } catch {
        return
      }

      // Track the active node from events
      if (event.type === 'message_user' && event.node_id) {
        setActiveNodeId(event.node_id)
        setSelectedNodeId((prev) => prev ?? event.node_id!)
      }

      // Accumulate live messages for the detail panel
      if (event.type === 'message_user' && event.text) {
        setLiveMessages((prev) => [...prev, { role: 'user', content: event.text! }])
      } else if (event.type === 'message_ai' && event.text) {
        setLiveMessages((prev) => {
          // Append to last assistant message if streaming, otherwise add new
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { role: 'assistant', content: last.content + event.text! }]
          }
          return [...prev, { role: 'assistant', content: event.text! }]
        })
      }

      // Update streaming state
      if (event.type === 'turn_result') {
        setIsStreaming(false)
        setLiveMessages([])
        // Refetch nodes so materialized_context updates
        client.get<Node[]>(`/nodes/?graph=${graphId}`).then((r) => {
          setNodes(r.data)
        }).catch(() => {})
      } else if (['message_user', 'pre_tool_use'].includes(event.type)) {
        setIsStreaming(true)
      }
    }

    return () => ws.close()
  }, [graphId])

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <Link to="/" style={{ color: '#4b5563', textDecoration: 'none', fontSize: 13 }}>
          ← App
        </Link>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>
          {graph?.name ?? 'Loading…'}
        </span>
        <div style={{ flex: 1 }} />
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: connected ? '#22c55e' : '#4b5563',
            boxShadow: connected ? '0 0 6px #22c55e' : 'none',
            transition: 'all 0.3s',
          }} />
          <span style={{ fontSize: 11, color: connected ? '#22c55e' : '#4b5563' }}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Body */}
      <PanelGroup orientation="horizontal" className="flex-1">
        <Panel defaultSize={60} minSize={30}>
          <GraphPanel
            nodes={nodes}
            activeNodeId={activeNodeId}
            selectedNodeId={selectedNodeId}
            loading={isStreaming}
            onSelectNode={(node) => setSelectedNodeId(node.id)}
            onBranchFromNode={() => {}}
          />
        </Panel>

        <PanelResizeHandle className="w-[1px] bg-white/[0.08] hover:bg-indigo-500/60 hover:w-[2px] transition-all cursor-col-resize" />

        <Panel defaultSize={40} minSize={20}>
          <NodeDetailPanel
            node={selectedNode}
            isActiveNode={selectedNode?.id === activeNodeId}
            isStreaming={isStreaming}
            liveMessages={liveMessages}
            onBranch={() => {}}
          />
        </Panel>
      </PanelGroup>
    </div>
  )
}

