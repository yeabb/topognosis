import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  type Node as FlowNode,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'
import type { Node } from '../types/index'

const NODE_WIDTH = 210
const NODE_HEIGHT = 88

function layoutGraph(nodes: FlowNode[], edges: Edge[]): FlowNode[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 })

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } }
  })
}

interface NodeData {
  label: string
  model: string
  messageCount: number
  isActive: boolean
  isStreaming: boolean
  isBranch: boolean
  branchOriginSnippet: string
  onClick: () => void
  onBranch: () => void
  [key: string]: unknown
}

function ConversationNode({ data }: NodeProps) {
  const d = data as NodeData
  const [branchHovered, setBranchHovered] = useState(false)

  const modelLabel = d.model.includes('haiku')
    ? 'Haiku'
    : d.model.includes('sonnet')
    ? 'Sonnet'
    : d.model.includes('opus')
    ? 'Opus'
    : d.model

  return (
    <div style={{ position: 'relative', width: NODE_WIDTH, overflow: 'visible' }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* Card */}
      <div
        onClick={d.onClick}
        style={{
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          borderRadius: 12,
          padding: '10px 12px 8px',
          background: d.isActive ? '#1a1f2e' : '#141414',
          border: d.isActive ? '1.5px solid #6366f1' : '1px solid rgba(255,255,255,0.07)',
          boxShadow: d.isActive ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {/* Branch origin snippet */}
        {d.isBranch && d.branchOriginSnippet && (
          <div style={{
            fontSize: 9,
            color: '#6366f1',
            marginBottom: 4,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            opacity: 0.8,
          }}>
            ↳ {d.branchOriginSnippet}
          </div>
        )}

        {/* Label */}
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: d.isActive ? '#e2e8f0' : '#9ca3af',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: d.isBranch ? 1 : 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: '1.4',
          flex: 1,
        }}>
          {d.label || (d.isBranch ? 'New branch…' : 'Untitled')}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{
            fontSize: 10,
            color: '#4b5563',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 4,
            padding: '1px 5px',
          }}>
            {modelLabel}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {d.isStreaming && (
              <div style={{ display: 'flex', gap: 3 }}>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="animate-bounce"
                    style={{ width: 4, height: 4, borderRadius: '50%', background: '#6366f1', display: 'inline-block', animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            )}
            <span style={{ fontSize: 10, color: '#4b5563' }}>
              {d.messageCount} msg{d.messageCount !== 1 ? 's' : ''}
            </span>

          </div>
        </div>
      </div>

      {/* Branch button — straddles the bottom-right corner, half in half out */}
      <button
        onClick={(e) => { e.stopPropagation(); d.onBranch() }}
        onMouseEnter={() => setBranchHovered(true)}
        onMouseLeave={() => setBranchHovered(false)}
        style={{
          position: 'absolute',
          bottom: -18,
          right: -18,
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: '1.5px solid rgba(99,102,241,0.6)',
          background: branchHovered ? '#6366f1' : '#1a1f2e',
          color: '#818cf8',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          transition: 'all 0.15s ease',
          boxShadow: branchHovered
            ? '0 0 0 2px #0a0a0a, 0 0 8px rgba(99,102,241,0.4)'
            : '0 0 0 2px #0a0a0a',
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
        {/* Inline tooltip */}
        {branchHovered && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 6,
            background: '#1e1e1e',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#d4d4d4',
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            Branch from here
          </div>
        )}
      </button>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { conversation: ConversationNode }

interface Props {
  nodes: Node[]
  activeNodeId: string | null
  loading: boolean
  onSelectNode: (node: Node) => void
  onBranchFromNode: (node: Node) => void
}

export default function GraphPanel({ nodes, activeNodeId, loading, onSelectNode, onBranchFromNode }: Props) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([])

  const buildGraph = useCallback(() => {
    if (nodes.length === 0) {
      setFlowNodes([])
      setFlowEdges([])
      return
    }

    const raw: FlowNode[] = nodes.map((n) => {
      const isBranch = (n.parents ?? []).length > 0
      // Snippet from the last message in the inherited context (the branch point)
      const branchOriginSnippet = isBranch && n.materialized_context.length > 0
        ? (n.materialized_context[n.inherited_context_length - 1]?.content ?? '').slice(0, 40)
        : ''

      return {
        id: n.id,
        type: 'conversation',
        position: { x: 0, y: 0 },
        data: {
          label: n.label || 'Untitled',
          model: n.model,
          messageCount: n.materialized_context.length,
          isActive: n.id === activeNodeId,
          isStreaming: n.id === activeNodeId && loading,
          isBranch,
          branchOriginSnippet,
          onClick: () => onSelectNode(n),
          onBranch: () => onBranchFromNode(n),
        },
      }
    })

    const edges: Edge[] = nodes.flatMap((n) =>
      (n.parents ?? []).map((parentId) => ({
        id: `${parentId}->${n.id}`,
        source: parentId,
        target: n.id,
        style: {
          stroke: n.id === activeNodeId || parentId === activeNodeId
            ? '#6366f1'
            : 'rgba(255,255,255,0.1)',
          strokeWidth: n.id === activeNodeId || parentId === activeNodeId ? 2 : 1,
        },
        animated: n.id === activeNodeId && loading,
      }))
    )

    const laid = layoutGraph(raw, edges)
    setFlowNodes(laid)
    setFlowEdges(edges)
  }, [nodes, activeNodeId, loading, onSelectNode, onBranchFromNode, setFlowNodes, setFlowEdges])

  useEffect(() => {
    buildGraph()
  }, [buildGraph])

  const isEmpty = nodes.length === 0

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-600">
              <circle cx="12" cy="5" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="19" cy="19" r="2" />
              <line x1="12" y1="7" x2="5" y2="17" />
              <line x1="12" y1="7" x2="19" y2="17" />
            </svg>
          </div>
          <p className="text-neutral-600 text-xs">Start a conversation to see your graph</p>
        </div>
      ) : (
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(255,255,255,0.03)" variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      )}
    </div>
  )
}
