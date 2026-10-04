import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-[#0b0f17] text-gray-100 flex flex-col justify-between p-6">
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-4 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
            ⚡
          </div>
          <span className="text-xl font-bold tracking-tight text-white">TokenTrail</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
            Dev Mode
          </span>
        </div>
        <div className="text-sm text-gray-400">
          Backend: <code className="text-emerald-400 bg-gray-900 px-2 py-0.5 rounded">http://localhost:8000</code>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full my-auto py-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800/80 border border-gray-700 text-xs text-gray-300 mb-6">
          <span>Stage A0: Development Setup Initialized</span>
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
          LLM Observability <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Built for Agents & Production
          </span>
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
          Zero-overhead tracing, fail-safe Python SDK, dynamic model pricing engine, and responsive waterfall timelines.
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setCount((c) => c + 1)}
            className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold text-sm transition-colors cursor-pointer"
          >
            Interactive Test Counter: {count}
          </button>
          <a
            href="http://localhost:8000/healthz"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium text-sm transition-colors"
          >
            Check Backend /healthz ↗
          </a>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto w-full py-4 border-t border-gray-800 text-center text-xs text-gray-500">
        TokenTrail Observability • Stage A Development
      </footer>
    </div>
  )
}
