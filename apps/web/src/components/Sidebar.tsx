import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import client from '../api/client'
import type { Graph } from '../types'

interface Props {
  activeGraphId: string | null
  onSelectGraph: (graph: Graph) => void
  onNewGraph: () => void
}

function groupByDate(graphs: Graph[]): { label: string; items: Graph[] }[] {
  const now = new Date()
  const today: Graph[] = []
  const yesterday: Graph[] = []
  const last7: Graph[] = []
  const older: Graph[] = []

  graphs.forEach((g) => {
    const d = new Date(g.updated_at)
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) today.push(g)
    else if (diffDays === 1) yesterday.push(g)
    else if (diffDays <= 7) last7.push(g)
    else older.push(g)
  })

  const groups = []
  if (today.length) groups.push({ label: 'Today', items: today })
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday })
  if (last7.length) groups.push({ label: 'Previous 7 days', items: last7 })
  if (older.length) groups.push({ label: 'Older', items: older })
  return groups
}

function GraphGroup({ label, items, activeGraphId, onSelectGraph }: {
  label: string
  items: Graph[]
  activeGraphId: string | null
  onSelectGraph: (g: Graph) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-1 text-neutral-600 hover:text-neutral-400 transition group"
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span className="text-xs font-medium">{label}</span>
      </button>

      {!collapsed && (
        <ul className="flex flex-col gap-0.5 mt-0.5">
          {items.map((graph) => (
            <li key={graph.id}>
              <button
                onClick={() => onSelectGraph(graph)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm truncate transition ${
                  activeGraphId === graph.id
                    ? 'bg-white/[0.1] text-white'
                    : 'text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200'
                }`}
              >
                {graph.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Sidebar({ activeGraphId, onSelectGraph, onNewGraph }: Props) {
  const { user, logout } = useAuth()
  const [graphs, setGraphs] = useState<Graph[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client
      .get<Graph[]>('/graphs/')
      .then((res) => setGraphs(res.data))
      .finally(() => setLoading(false))
  }, [])

  const groups = groupByDate(graphs)

  return (
    <aside className="flex flex-col h-full w-[260px] bg-[#171717]">
      {/* New graph button */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNewGraph}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-neutral-200 hover:bg-white/[0.07] transition group"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400 group-hover:text-white transition">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New graph
        </button>
      </div>

      {/* Graph list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <p className="text-neutral-600 text-xs px-3 py-2">Loading…</p>
        ) : graphs.length === 0 ? (
          <p className="text-neutral-600 text-xs px-3 py-6 text-center">No graphs yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <GraphGroup
                key={group.label}
                label={group.label}
                items={group.items}
                activeGraphId={activeGraphId}
                onSelectGraph={onSelectGraph}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/[0.08]">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.05] transition group cursor-default">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-medium">
              {user?.username?.[0]?.toUpperCase()}
            </span>
          </div>
          <span className="text-neutral-300 text-sm truncate flex-1">{user?.username}</span>
          <button
            onClick={logout}
            title="Sign out"
            className="text-neutral-600 hover:text-neutral-300 transition opacity-0 group-hover:opacity-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
