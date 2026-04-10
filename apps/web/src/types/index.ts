export interface User {
  id: string
  username: string
  email: string
  bio: string
  created_at: string
}

export interface Graph {
  id: string
  owner: string
  name: string
  description: string
  visibility: 'public' | 'private'
  slug: string
  created_at: string
  updated_at: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export type NodeStatus = 'active' | 'dead_end' | 'merged'

export interface Node {
  id: string
  graph: string
  parents: string[]
  children: string[]
  label: string
  summary: string
  status: NodeStatus
  inherited_context_length: number
  materialized_context: Message[]
  compressed_context: Message[]
  delta_events: object[]
  git_hash: string
  model: string
  tool: string
  created_at: string
  updated_at: string
}
