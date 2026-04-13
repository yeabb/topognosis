import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import GraphPanel from '../components/GraphPanel'
import client from '../api/client'
import type { Graph, Node } from '../types/index'

interface LiveEvent {
  id: string
  type: string
  tool_name?: string
  text?: string
  tool_input?: Record<string, unknown>
  cost_usd?: number
  num_turns?: number
  timestamp?: string
}

const WS_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000')
  .replace(/^https/, 'wss')
  .replace(/^http/, 'ws')

export default function GraphPage() {
  const { graphId } = useParams<{ graphId: string }>()
  const [graph, setGraph] = useState<Graph | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  // Initial load
  useEffect(() => {
    if (!graphId) return

    client.get<Graph>(`/graphs/${graphId}/`).then((r) => setGraph(r.data)).catch(() => {})

    client.get<Node[]>(`/nodes/?graph=${graphId}`).then((r) => {
      setNodes(r.data)
      const active = r.data.find((n) => n.status === 'active') ?? r.data[r.data.length - 1]
      if (active) setActiveNodeId(active.id)
    }).catch(() => {})
  }, [graphId])

  // WebSocket connection
  useEffect(() => {
    if (!graphId) return
    const token = localStorage.getItem('access_token')
    if (!token) return

    const ws = new WebSocket(`${WS_BASE}/ws/graphs/${graphId}/?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    ws.onmessage = (e) => {
      let event: LiveEvent
      try {
        event = JSON.parse(e.data)
      } catch {
        return
      }

      // Update streaming state
      if (event.type === 'turn_result') {
        setIsStreaming(false)
        // Refetch nodes so message counts update
        client.get<Node[]>(`/nodes/?graph=${graphId}`).then((r) => {
          setNodes(r.data)
        }).catch(() => {})
      } else if (['message_user', 'pre_tool_use'].includes(event.type)) {
        setIsStreaming(true)
      }

      // Track the active node from events
      if (event.type === 'message_user' && (event as any).node_id) {
        setActiveNodeId((event as any).node_id)
      }

      // Append to feed (skip noisy internal events)
      if (!['message_ai_thinking', 'rate_limit'].includes(event.type)) {
        setEvents((prev) => [...prev.slice(-199), event])
      }
    }

    return () => ws.close()
  }, [graphId])

  // Auto-scroll event feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [events])

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
        <Panel defaultSize={65} minSize={30}>
          <GraphPanel
            nodes={nodes}
            activeNodeId={activeNodeId}
            loading={isStreaming}
            onSelectNode={() => {}}
            onBranchFromNode={() => {}}
          />
        </Panel>

        <PanelResizeHandle className="w-[1px] bg-white/[0.08] hover:bg-indigo-500/60 hover:w-[2px] transition-all cursor-col-resize" />

        {/* Event feed */}
        <Panel defaultSize={35} minSize={15}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#4b5563', flexShrink: 0 }}>
              ACTIVITY
            </div>
            <div
              ref={feedRef}
              style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
            >
              {events.length === 0 ? (
                <div style={{ padding: '16px 14px', fontSize: 12, color: '#374151' }}>
                  Waiting for session activity…
                </div>
              ) : (
                events.map((ev, i) => (
                  <EventRow key={ev.id ?? i} event={ev} />
                ))
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}

function EventRow({ event }: { event: LiveEvent }) {
  const style: React.CSSProperties = {
    padding: '5px 14px',
    fontSize: 11,
    lineHeight: '1.5',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  }

  switch (event.type) {
    case 'message_user':
      return (
        <div style={style}>
          <span style={{ color: '#6366f1' }}>you  </span>
          <span style={{ color: '#9ca3af' }}>{truncate(event.text ?? '', 80)}</span>
        </div>
      )
    case 'message_ai':
      return (
        <div style={style}>
          <span style={{ color: '#22c55e' }}>ai   </span>
          <span style={{ color: '#6b7280' }}>{truncate(event.text ?? '', 80)}</span>
        </div>
      )
    case 'pre_tool_use':
      return (
        <div style={style}>
          <span style={{ color: '#f59e0b' }}>⚙    </span>
          <span style={{ color: '#d97706' }}>{event.tool_name}</span>
          {event.tool_input && (
            <span style={{ color: '#4b5563' }}> {toolSummary(event.tool_name ?? '', event.tool_input)}</span>
          )}
        </div>
      )
    case 'post_tool_use':
      return null
    case 'turn_result':
      return (
        <div style={{ ...style, color: '#374151' }}>
          ✓ {event.num_turns} turn{event.num_turns !== 1 ? 's' : ''}
          {event.cost_usd != null ? `  $${event.cost_usd.toFixed(4)}` : ''}
        </div>
      )
    case 'error':
      return (
        <div style={{ ...style, color: '#ef4444' }}>
          error: {(event as any).message ?? 'unknown'}
        </div>
      )
    default:
      return null
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function toolSummary(name: string, input: Record<string, unknown>): string {
  if (['Read', 'Edit', 'Write', 'MultiEdit'].includes(name))
    return truncate(String(input.file_path ?? input.path ?? ''), 40)
  if (name === 'Bash')
    return truncate(String(input.command ?? ''), 40)
  if (['Glob', 'Grep'].includes(name))
    return truncate(String(input.pattern ?? ''), 40)
  const first = Object.values(input).find((v) => typeof v === 'string')
  return first ? truncate(String(first), 40) : ''
}
