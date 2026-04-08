import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import client from '../api/client'
import type { Graph } from '../types'

interface Props {
  activeGraphId: string | null
  onSelectGraph: (graph: Graph) => void
  onNewGraph: () => void
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

  return (
    <aside className="flex flex-col h-full w-64 border-r border-white/10 bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10">
        <span className="text-white text-sm font-semibold tracking-tight">topognosis</span>
      </div>

      {/* New graph button */}
      <div className="px-3 py-3">
        <button
          onClick={onNewGraph}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/[0.06] hover:text-white transition"
        >
          <span className="text-lg leading-none">+</span>
          New graph
        </button>
      </div>

      {/* Graph list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <p className="text-neutral-600 text-xs px-3 py-2">Loading…</p>
        ) : graphs.length === 0 ? (
          <p className="text-neutral-600 text-xs px-3 py-2">No graphs yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {graphs.map((graph) => (
              <li key={graph.id}>
                <button
                  onClick={() => onSelectGraph(graph)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm truncate transition ${
                    activeGraphId === graph.id
                      ? 'bg-white/[0.08] text-white'
                      : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
                  }`}
                >
                  {graph.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer — user + logout */}
      <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
        <span className="text-neutral-500 text-xs truncate">{user?.username}</span>
        <button
          onClick={logout}
          className="text-neutral-600 hover:text-neutral-300 text-xs transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
