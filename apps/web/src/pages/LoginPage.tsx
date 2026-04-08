import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[#0f0f0f]">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <span className="text-white text-xl font-semibold tracking-tight">topognosis</span>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-8 py-8">
          <h1 className="text-white text-lg font-medium mb-1">Sign in</h1>
          <p className="text-neutral-500 text-sm mb-6">Welcome back.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-neutral-400 text-xs uppercase tracking-wider">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="rounded-lg bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition"
                placeholder="your_username"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-neutral-400 text-xs uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-lg bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white transition"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-neutral-500 text-sm">
          No account?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 transition">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
