import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Graph, Message } from '../types'

interface Props {
  activeGraph: Graph | null
  messages: Message[]
  onSend: (content: string) => void
  loading: boolean
}

export default function ChatPanel({ activeGraph, messages, onSend, loading }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
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
    <div className="flex flex-col h-full">
      {/* Model indicator */}
      <div className="flex items-center justify-center py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5 text-neutral-400 text-sm cursor-pointer hover:text-neutral-200 transition">
          <span>Claude</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
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
            {messages.map((msg, i) => {
              const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
              const isStreaming = isLastAssistant && loading
              return (
                <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-neutral-600 text-xs">Claude</span>
                      {isStreaming && (
                        <div className="flex gap-1">
                          <span className="w-1 h-1 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
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
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input — always full width of the panel */}
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
