import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Graph, Message } from '../types/index'

interface Model {
  id: string
  label: string
  available: boolean
}

const MODELS: Model[] = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku', available: true },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet', available: false },
  { id: 'claude-opus-4-6', label: 'Claude Opus', available: false },
  { id: 'gpt-4o', label: 'GPT-4o', available: false },
  { id: 'gemini-2.0-flash', label: 'Gemini Flash', available: false },
]

interface Props {
  activeGraph: Graph | null
  messages: Message[]
  inheritedContextLength: number
  onSend: (content: string, model: string) => void
  onBranch: (messageIndex: number) => void
  loading: boolean
}

export default function ChatPanel({ activeGraph, messages, inheritedContextLength, onSend, onBranch, loading }: Props) {
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState(MODELS[0])
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [hoveredMsgIndex, setHoveredMsgIndex] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return
    onSend(trimmed, selectedModel.id)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full" onClick={() => setModelMenuOpen(false)}>
      {/* Model selector */}
      <div className="flex items-center justify-center border-b border-white/[0.06] relative" style={{ padding: '16px 0 12px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setModelMenuOpen((v) => !v) }}
          className="flex items-center gap-1.5 text-neutral-400 text-sm hover:text-neutral-200 transition"
        >
          <span>{selectedModel.label}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {modelMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full mt-1 z-20 w-52 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl overflow-hidden"
          >
            {MODELS.map((model) => (
              <button
                key={model.id}
                disabled={!model.available}
                onClick={() => { setSelectedModel(model); setModelMenuOpen(false) }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition ${
                  !model.available
                    ? 'text-neutral-600 cursor-not-allowed'
                    : selectedModel.id === model.id
                    ? 'text-white bg-white/[0.08]'
                    : 'text-neutral-300 hover:bg-white/[0.05]'
                }`}
              >
                <span>{model.label}</span>
                {!model.available && (
                  <span className="text-xs text-neutral-700">soon</span>
                )}
                {model.available && selectedModel.id === model.id && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
            <h2 className="text-white text-xl font-medium">
              {activeGraph ? activeGraph.name : 'New graph'}
            </h2>
            <p className="text-neutral-500 text-sm">
              Start a conversation. Your reasoning will be captured as a navigable graph.
            </p>
          </div>
        ) : (
          <div className="w-full py-8 flex flex-col gap-6" style={{ paddingLeft: '80px', paddingRight: '80px' }}>

            {/* Inherited context divider — shown at top if this is a branch */}
            {inheritedContextLength > 0 && (
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-xs text-neutral-600 shrink-0">branched from here</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
            )}

            {messages.map((msg, i) => {
              const isInherited = i < inheritedContextLength
              const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
              const isStreaming = isLastAssistant && loading

              return (
                <div key={i}>
                  {/* Divider between inherited and new messages */}
                  {inheritedContextLength > 0 && i === inheritedContextLength && (
                    <div className="flex items-center gap-3 py-1 mb-6">
                      <div className="flex-1 h-px bg-indigo-500/30" />
                      <span className="text-xs text-indigo-400/70 shrink-0">new branch</span>
                      <div className="flex-1 h-px bg-indigo-500/30" />
                    </div>
                  )}

                  <div
                    className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    style={{ opacity: isInherited ? 0.45 : 1, transition: 'opacity 0.15s' }}
                    onMouseEnter={() => msg.role === 'assistant' && setHoveredMsgIndex(i)}
                    onMouseLeave={() => setHoveredMsgIndex(null)}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 px-1 w-full justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-600 text-xs">Claude</span>
                          {isStreaming && (
                            <div className="flex gap-1">
                              <span className="w-1 h-1 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1 h-1 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1 h-1 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          )}
                        </div>

                        {/* Branch button — visible on hover of any AI message */}
                        {!isStreaming && (
                          <button
                            onClick={() => onBranch(i)}
                            title="Branch from here"
                            style={{
                              opacity: hoveredMsgIndex === i ? 1 : 0,
                              transition: 'opacity 0.15s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: '1px solid rgba(99,102,241,0.3)',
                              background: 'rgba(99,102,241,0.08)',
                              color: '#818cf8',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="6" y1="3" x2="6" y2="15" />
                              <circle cx="18" cy="6" r="3" />
                              <circle cx="6" cy="18" r="3" />
                              <path d="M18 9a9 9 0 0 1-9 9" />
                            </svg>
                            Branch
                          </button>
                        )}
                      </div>
                    )}

                    <div
                      className={`text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#2f2f2f] text-white rounded-3xl px-5 py-3 max-w-[85%]'
                          : 'text-neutral-200 w-full'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : msg.content}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06]" style={{ padding: '24px 80px 32px' }}>
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-3 rounded-3xl bg-[#2f2f2f] px-6 py-4"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind?"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none leading-relaxed"
            style={{ minHeight: '24px', maxHeight: '200px', paddingLeft: '8px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 rounded-full bg-white hover:bg-neutral-200 disabled:bg-neutral-700 disabled:cursor-not-allowed flex items-center justify-center transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-black">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
        <p className="text-neutral-700 text-xs mt-3 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
