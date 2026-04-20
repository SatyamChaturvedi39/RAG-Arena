import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Send, Loader2, Zap, TreePine, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import { compareQuery, listDocuments } from '../api/client'
import clsx from 'clsx'

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PanelSkeleton({ color }) {
  const isVector = color === 'vector'
  const accentColor = isVector ? 'rgba(59,130,246,' : 'rgba(139,92,246,'
  return (
    <div
      className="flex-1 min-w-0 rounded-2xl border p-5 flex flex-col gap-4"
      style={{ background: `${accentColor}0.04)`, borderColor: `${accentColor}0.20)` }}
    >
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-24 rounded-full" />
        <div className="skeleton h-4 w-28 rounded" />
      </div>
      <div className="space-y-2 mt-2">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-11/12 rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-3/4 rounded" />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: isVector ? '#60a5fa' : '#a78bfa',
                opacity: 0.4,
                animation: `glow-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <span className="text-xs text-slate-600">Running pipeline…</span>
      </div>
    </div>
  )
}

// ─── Latency comparison bar ───────────────────────────────────────────────────

function LatencyBar({ vectorMs, vectorlessMs }) {
  if (!vectorMs || !vectorlessMs) return null
  const total = vectorMs + vectorlessMs
  const vPct = Math.round((vectorMs / total) * 100)
  const vlPct = 100 - vPct
  const fasterIsVector = vectorMs <= vectorlessMs
  const speedup = (Math.max(vectorMs, vectorlessMs) / Math.min(vectorMs, vectorlessMs)).toFixed(1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="rounded-2xl border p-4"
      style={{ background: 'rgba(15,22,35,0.5)', borderColor: 'rgba(30,45,66,0.6)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Latency comparison</span>
        <span className="text-xs text-slate-500">
          {fasterIsVector
            ? <span className="text-vector-400">Vector RAG</span>
            : <span className="text-vectorless-400">Vectorless RAG</span>
          }
          {' '}was <span className="text-green-400 font-semibold">{speedup}× faster</span>
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-vector-400 w-20 shrink-0">Vector</span>
          <div className="flex-1 latency-bar-track">
            <div className="latency-bar-fill-vector" style={{ width: `${vPct}%` }} />
          </div>
          <span className="text-xs font-mono text-slate-400 w-16 text-right">{vectorMs}ms</span>
          {fasterIsVector && <span className="badge-winner text-xs">⚡ FASTER</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-vectorless-400 w-20 shrink-0">Vectorless</span>
          <div className="flex-1 latency-bar-track">
            <div className="latency-bar-fill-vectorless" style={{ width: `${vlPct}%` }} />
          </div>
          <span className="text-xs font-mono text-slate-400 w-16 text-right">{vectorlessMs}ms</span>
          {!fasterIsVector && <span className="badge-winner text-xs">⚡ FASTER</span>}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Router badge ─────────────────────────────────────────────────────────────

function RouterBadge({ router }) {
  if (!router) return null
  const isVectorless = router.recommended === 'vectorless'
  const accentColor = isVectorless ? 'rgba(139,92,246,' : 'rgba(59,130,246,'
  const textColor   = isVectorless ? '#a78bfa' : '#60a5fa'

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-2xl p-4 border"
      style={{
        background: `${accentColor}0.05)`,
        borderColor: `${accentColor}0.20)`,
        boxShadow: `0 0 30px ${accentColor}0.06)`,
      }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-medium">
            Router Recommendation
          </p>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className={clsx('text-sm font-semibold', isVectorless ? 'text-vectorless-400' : 'text-vector-400')}>
              {isVectorless ? 'Vectorless RAG' : 'Vector RAG'}
            </span>
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium"
              style={{ background: `${accentColor}0.12)`, color: textColor, border: `1px solid ${accentColor}0.2)` }}
            >
              {(router.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">{router.reasoning}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Answer panel ─────────────────────────────────────────────────────────────

function AnswerPanel({ color, result, delay = 0 }) {
  const isVector   = color === 'vector'
  const label      = isVector ? 'Vector RAG' : 'Vectorless RAG'
  const accentColor = isVector ? 'rgba(59,130,246,' : 'rgba(139,92,246,'
  const textColor   = isVector ? '#60a5fa' : '#a78bfa'
  const chunksRef  = useRef(null)

  useEffect(() => {
    if (!result || result.error) return
    const items = chunksRef.current?.querySelectorAll('.chunk-item')
    if (items?.length) {
      gsap.from(items, { opacity: 0, y: 12, stagger: 0.07, duration: 0.4, ease: 'power2.out', delay: 0.1 })
    }
  }, [result])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={clsx('flex-1 min-w-0 rounded-2xl border p-5 flex flex-col gap-4',
        result && !result.error && (isVector ? 'panel-vector loaded' : 'panel-vectorless loaded'),
        !result?.error && 'transition-all duration-300'
      )}
      style={{
        background: `${accentColor}0.04)`,
        borderColor: `${accentColor}0.20)`,
        boxShadow: `0 0 40px ${accentColor}0.06), inset 0 1px 0 ${accentColor}0.07)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={isVector ? 'badge-vector' : 'badge-vectorless'}>{label}</span>
        {result && !result.error && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xs text-slate-500 font-mono tabular-nums"
          >
            {result.latency_ms}ms · {(result.llm_prompt_tokens || 0) + (result.llm_completion_tokens || 0)} tok
          </motion.span>
        )}
      </div>

      {/* Answer */}
      {result && (
        <div className="space-y-4" ref={chunksRef}>
          {result.error ? (
            <div className="rounded-xl p-3 text-sm text-red-400 border"
              style={{ background: 'rgba(248,113,113,0.05)', borderColor: 'rgba(248,113,113,0.15)' }}>
              <p className="font-medium mb-1">Pipeline error</p>
              <p className="text-xs text-red-400/70">{result.error}</p>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-slate-200 answer-text">{result.answer}</p>
          )}

          {result.chunks && result.chunks.length > 0 && (
            <details className="group">
              <summary className="text-xs cursor-pointer select-none list-none flex items-center gap-1.5 transition-colors"
                style={{ color: textColor }}>
                <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                {result.chunks.length} chunks retrieved
              </summary>
              <div className="mt-2 space-y-2">
                {result.chunks.map((c, i) => (
                  <div key={i} className="chunk-item rounded-xl p-3 text-xs border"
                    style={{ background: 'rgba(15,22,35,0.8)', borderColor: 'rgba(30,45,66,0.7)' }}>
                    <div className="flex justify-between text-slate-600 mb-1.5 font-mono">
                      <span>{c.page != null ? `Page ${c.page + 1}` : '—'}</span>
                      <span style={{ color: textColor }}>{(c.similarity * 100).toFixed(1)}% match</span>
                    </div>
                    <p className="text-slate-400 line-clamp-3 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {result.navigation_path && (
            <details className="group">
              <summary className="text-xs cursor-pointer select-none list-none flex items-center gap-1.5"
                style={{ color: textColor }}>
                <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                Navigation · {result.nodes_visited_count} LLM call{result.nodes_visited_count !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 rounded-xl p-3 border"
                style={{ background: 'rgba(15,22,35,0.8)', borderColor: 'rgba(30,45,66,0.7)' }}>
                <p className="text-xs font-mono text-slate-400 leading-relaxed">{result.navigation_path}</p>
                {result.fallback_used && (
                  <p className="mt-2 text-xs text-yellow-500/80">⚠ Fallback mode — low-structure document</p>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Compare page ─────────────────────────────────────────────────────────────

export default function Compare() {
  const [searchParams] = useSearchParams()
  const preselectedDocId = searchParams.get('doc')

  const [selectedDocId, setSelectedDocId] = useState(preselectedDocId || '')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)

  const { data: docsData } = useQuery({
    queryKey: ['documents', 'ready'],
    queryFn: () => listDocuments({ status: 'ready' }).then((r) => r.data),
  })
  const readyDocs = docsData?.items || []

  const compareMutation = useMutation({
    mutationFn: () => compareQuery(selectedDocId, query).then((r) => r.data),
    onSuccess: (data) => setResult(data),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedDocId || !query.trim()) return
    setResult(null)
    compareMutation.mutate()
  }

  const isLoading = compareMutation.isPending
  const hasResult = !!result

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Compare</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Ask a question — both pipelines run in parallel and answer side by side.
        </p>
      </div>

      {/* Query form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border p-4"
        style={{
          background: 'rgba(15,22,35,0.65)',
          borderColor: 'rgba(30,45,66,0.7)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="input w-48 shrink-0"
          >
            <option value="">Select document…</option>
            {readyDocs.map((d) => (
              <option key={d.id} value={d.id}>{d.filename}</option>
            ))}
          </select>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about the document…"
            className="input flex-1 min-w-0"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
          />

          <button
            type="submit"
            disabled={!selectedDocId || !query.trim() || isLoading}
            className="btn-primary flex items-center gap-2 shrink-0 px-5"
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
            Run
          </button>
        </div>

        {compareMutation.isError && (
          <p className="mt-3 text-xs text-red-400">
            {compareMutation.error?.response?.data?.detail || 'Request failed — check backend logs'}
          </p>
        )}
      </form>

      {/* Pipeline labels during loading */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-1"
          >
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Zap className="w-3.5 h-3.5 text-vector-400" />
              <span>Vector RAG running…</span>
            </div>
            <span className="text-slate-700">·</span>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <TreePine className="w-3.5 h-3.5 text-vectorless-400" />
              <span>Vectorless RAG navigating tree…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Router badge */}
      <AnimatePresence>
        {result?.router && <RouterBadge router={result.router} />}
      </AnimatePresence>

      {/* Latency bar */}
      <AnimatePresence>
        {hasResult && result.vector && result.vectorless &&
          !result.vector.error && !result.vectorless.error && (
          <LatencyBar
            vectorMs={result.vector.latency_ms}
            vectorlessMs={result.vectorless.latency_ms}
          />
        )}
      </AnimatePresence>

      {/* Side-by-side panels */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex gap-4"
          >
            <PanelSkeleton color="vector" />
            <PanelSkeleton color="vectorless" />
          </motion.div>
        )}
        {hasResult && !isLoading && (
          <motion.div key="results" className="flex gap-4">
            <AnswerPanel color="vector"     result={result?.vector}     delay={0}    />
            <AnswerPanel color="vectorless" result={result?.vectorless} delay={0.08} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!hasResult && !isLoading && readyDocs.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border py-20 text-center"
          style={{ background: 'rgba(15,22,35,0.4)', borderColor: 'rgba(30,45,66,0.5)', borderStyle: 'dashed' }}
        >
          <p className="text-slate-600 text-sm">
            No documents ready.{' '}
            <a href="/" className="text-accent-400 hover:text-accent-300 transition-colors">
              Upload a PDF
            </a>{' '}
            to get started.
          </p>
        </motion.div>
      )}
    </div>
  )
}
