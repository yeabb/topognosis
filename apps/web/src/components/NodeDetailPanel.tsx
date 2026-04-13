import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Node, Message } from '../types/index'

interface Props {
  node: Node | null
  isActiveNode: boolean
  isStreaming: boolean
  liveMessages: Message[]
  onBranch: (node: Node, messageIndex: number) => void
}

export default function NodeDetailPanel({
  node,
  isActiveNode,
  isStreaming,
  liveMessages,
  onBranch,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [node?.materialized_context.length, liveMessages.length])

  // All messages to display: persisted + any live ones not yet saved
  const messages = node
    ? [...node.materialized_context, ...liveMessages]
    : []

  if (!node) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: '#0a0a0a', borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}>
        <PanelHeader node={null} isActiveNode={false} isStreaming={false} />
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#374151' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p style={{ fontSize: 12, color: '#374151' }}>Click a node to view its conversation</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#0a0a0a', borderLeft: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <PanelHeader node={node} isActiveNode={isActiveNode} isStreaming={isStreaming} />

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0' }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <p style={{ fontSize: 12, color: '#374151' }}>No messages yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.map((msg, i) => {
              const isLive = i >= node.materialized_context.length
              const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
              const showStreaming = isLastAssistant && isStreaming && isActiveNode

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    opacity: isLive ? 0.85 : 1,
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2 }}>
                      <span style={{ fontSize: 11, color: '#4b5563' }}>Claude</span>
                      {showStreaming && (
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[0, 150, 300].map((delay) => (
                            <span
                              key={delay}
                              className="animate-bounce"
                              style={{ width: 3, height: 3, borderRadius: '50%', background: '#6b7280', display: 'inline-block', animationDelay: `${delay}ms` }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{
                    fontSize: 13,
                    lineHeight: '1.6',
                    maxWidth: '85%',
                    ...(msg.role === 'user' ? {
                      background: '#2f2f2f',
                      color: '#e2e8f0',
                      borderRadius: 18,
                      padding: '8px 14px',
                      whiteSpace: 'pre-wrap',
                    } : {
                      color: '#d1d5db',
                      width: '100%',
                    }),
                  }}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>

                  {/* Branch button — only on persisted assistant messages */}
                  {msg.role === 'assistant' && !showStreaming && !isLive && (
                    <button
                      onClick={() => onBranch(node, i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 6,
                        border: '1px solid rgba(99,102,241,0.35)',
                        background: 'rgba(99,102,241,0.08)',
                        color: '#818cf8', fontSize: 11, cursor: 'pointer',
                        transition: 'background 0.15s, border-color 0.15s',
                        marginLeft: 2,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(99,102,241,0.18)'
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="6" y1="3" x2="6" y2="15" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 9a9 9 0 0 1-9 9" />
                      </svg>
                      Branch from here
                    </button>
                  )}
                </div>
              )
            })}
            <div style={{ height: 24 }} />
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}

function PanelHeader({ node, isActiveNode, isStreaming }: {
  node: Node | null
  isActiveNode: boolean
  isStreaming: boolean
}) {
  const statusColor = {
    active: '#6366f1',
    dead_end: '#ef4444',
    merged: '#22c55e',
  }

  return (
    <div style={{
      padding: '10px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', gap: 8,
      flexShrink: 0, minHeight: 41,
    }}>
      {node ? (
        <>
          {/* Status dot */}
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: statusColor[node.status] ?? '#4b5563',
          }} />

          {/* Label */}
          <span style={{
            fontSize: 12, fontWeight: 500, color: '#e2e8f0',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {node.label || 'Untitled'}
          </span>

          {/* Tool badge */}
          {node.tool && (
            <span style={{
              fontSize: 10, color: '#4b5563',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 4, padding: '1px 6px', flexShrink: 0,
            }}>
              {node.tool}
            </span>
          )}

          {/* Active / streaming / inactive indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {isActiveNode && isStreaming ? (
              <div style={{ display: 'flex', gap: 3 }}>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="animate-bounce"
                    style={{ width: 4, height: 4, borderRadius: '50%', background: '#6366f1', display: 'inline-block', animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            ) : (
              <span style={{
                fontSize: 10,
                color: isActiveNode ? '#6366f1' : '#374151',
                background: isActiveNode ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActiveNode ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 4, padding: '1px 6px',
              }}>
                {isActiveNode ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
        </>
      ) : (
        <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>No node selected</span>
      )}
    </div>
  )
}
