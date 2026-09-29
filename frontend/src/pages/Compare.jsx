import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Send,
  Loader2,
  Zap,
  TreePine,
  ChevronRight,
  ChevronDown,
  Upload,
  Copy,
  Check,
  Download,
  ThumbsUp,
  Award,
  AlertCircle,
  Route,
  Sparkles,
  Info,
  Clock,
  Layers,
  HelpCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { compareQuery, listDocuments, submitVote, getVoteTally } from '../api/client'
import clsx from 'clsx'

const getSessionId = () => {
  let sid = sessionStorage.getItem('rag_arena_session_id')
  if (!sid) {
    sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    sessionStorage.setItem('rag_arena_session_id', sid)
  }
  return sid
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function PanelSkeleton({ color }) {
  const isVector = color === 'vector'
  const accentBorder = isVector ? 'border-indigo-500/30' : 'border-emerald-500/30'
  const accentGlow = isVector ? 'rgba(99,102,241,0.05)' : 'rgba(16,185,129,0.05)'
  const iconColor = isVector ? 'text-indigo-400' : 'text-emerald-400'
  const label = isVector ? 'Vector RAG' : 'Vectorless RAG'

  return (
    <div
      className={clsx('flex-1 min-w-0 rounded-2xl border p-6 flex flex-col gap-4', accentBorder)}
      style={{ background: accentGlow }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isVector ? <Zap className={clsx('w-4 h-4', iconColor)} /> : <TreePine className={clsx('w-4 h-4', iconColor)} />}
          <span className={clsx('text-xs font-semibold uppercase tracking-wider', iconColor)}>{label}</span>
        </div>
        <div className="skeleton h-4 w-20 rounded" />
      </div>
      <div className="space-y-2.5 mt-2">
        <div className="skeleton h-3.5 w-full rounded" />
        <div className="skeleton h-3.5 w-11/12 rounded" />
        <div className="skeleton h-3.5 w-4/5 rounded" />
        <div className="skeleton h-3.5 w-full rounded" />
      </div>
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
        <Loader2 className={clsx('w-3.5 h-3.5 animate-spin', iconColor)} />
        <span className="text-xs text-slate-400">Processing pipeline query...</span>
      </div>
    </div>
  )
}

// ─── Latency Comparison Component ─────────────────────────────────────────────

function LatencyBar({ vectorMs, vectorlessMs, handleExport }) {
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
      transition={{ delay: 0.15, duration: 0.35 }}
      className="rounded-2xl border p-5 bg-slate-900/80 border-slate-800 shadow-xl backdrop-blur-md"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <h4 className="text-sm font-semibold text-white tracking-wide">
              Execution Latency (Roundtrip Processing Time)
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Duration in milliseconds (ms). Lower is faster. <strong className="text-slate-300">This is speed performance, not an accuracy score.</strong>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
            <span>⚡</span>
            <span>{fasterIsVector ? 'Vector RAG' : 'Vectorless RAG'} was {speedup}× faster</span>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
            title="Download full JSON diagnostics"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" /> JSON Export
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Vector Latency */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-indigo-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" /> Vector RAG
            </span>
            <span className="font-mono text-slate-200 font-semibold">{vectorMs} ms</span>
          </div>
          <div className="latency-bar-track">
            <div className="latency-bar-fill-vector" style={{ width: `${vPct}%` }} />
          </div>
        </div>

        {/* Vectorless Latency */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-emerald-300 flex items-center gap-1.5">
              <TreePine className="w-3.5 h-3.5 text-emerald-400" /> Vectorless RAG
            </span>
            <span className="font-mono text-slate-200 font-semibold">{vectorlessMs} ms</span>
          </div>
          <div className="latency-bar-track">
            <div className="latency-bar-fill-vectorless" style={{ width: `${vlPct}%` }} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Unified DDAR Router Decision Banner ───────────────────────────────────────

function UnifiedRouterBanner({ router, ddar }) {
  const [openTelemetry, setOpenTelemetry] = useState(false)
  if (!router && !ddar) return null

  const routeValue = ddar?.route || router?.recommended || 'unknown'
  const isParametric = routeValue === 'parametric'
  const isVectorless = routeValue === 'vectorless'
  const isVector = routeValue === 'vector'

  const theme = isParametric ? {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    glow: 'rgba(245,158,11,0.12)',
    text: 'text-amber-400',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    label: 'Parametric (Skip Retrieval)',
    icon: Sparkles
  } : isVectorless ? {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    glow: 'rgba(16,185,129,0.12)',
    text: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    label: 'Vectorless RAG (Tree Navigation)',
    icon: TreePine
  } : {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    glow: 'rgba(99,102,241,0.12)',
    text: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    label: 'Vector RAG (Dense Embeddings)',
    icon: Zap
  }

  const IconComponent = theme.icon
  const s_q = ddar?.s_q || 0
  const theta_1 = ddar?.theta_1 || 11.5
  const d_q = ddar?.d_q || 0
  const theta_2 = ddar?.theta_2 || 0.15
  const sqt = ddar?.sqt || false

  const bar1Fill = Math.min(100, Math.max(0, (s_q / 40) * 100))
  const bar1Marker = (theta_1 / 40) * 100
  const bar1Active = s_q >= theta_1

  const bar2Fill = Math.min(100, Math.max(0, d_q * 100))
  const bar2Marker = theta_2 * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={clsx('rounded-2xl border backdrop-blur-md overflow-hidden shadow-xl transition-all', theme.bg, theme.border)}
    >
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border', theme.badgeBg)}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  DDAR Router Recommendation
                </span>
                <span className={clsx('text-xs px-2.5 py-0.5 rounded-full font-semibold border', theme.badgeBg)}>
                  {theme.label}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Deterministic
                </span>
              </div>
              <p className="text-sm text-slate-200 mt-1 font-medium leading-relaxed">
                {router?.reasoning || ddar?.reason || 'Evaluation completed.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setOpenTelemetry(!openTelemetry)}
            className="flex items-center gap-1.5 self-start md:self-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 transition-colors shrink-0"
          >
            <span>Telemetry Gauges</span>
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform duration-200"
              style={{ transform: openTelemetry ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        </div>

        {/* Collapsible Telemetry Details */}
        <AnimatePresence>
          {openTelemetry && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-5 pt-5 border-t border-slate-800/80 space-y-4"
            >
              {/* Axis 1 Gauge */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    Axis 1 — Mean Token Surprisal S(q)
                  </span>
                  <span className="font-mono text-slate-300">
                    S(q) = {s_q.toFixed(2)} bits (θ₁ threshold = {theta_1} bits)
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bar1Active ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                    {bar1Active ? '✓ RETRIEVAL REQUIRED' : '⚡ GENERAL KNOWLEDGE (SKIP)'}
                  </span>
                </div>
                <div className="relative h-4 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                  <div
                    className="h-full transition-all duration-500 rounded-lg"
                    style={{
                      width: `${bar1Fill}%`,
                      background: bar1Active ? 'linear-gradient(90deg, #0284c7, #38bdf8)' : 'linear-gradient(90deg, #d97706, #fbbf24)'
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                    style={{ left: `${bar1Marker}%` }}
                    title={`Threshold θ₁ = ${theta_1}`}
                  />
                </div>
              </div>

              {/* Axis 2 Gauge */}
              {bar1Active && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Route className="w-3.5 h-3.5 text-emerald-400" />
                      Axis 2 — Named Entity Density D(q) & SQT
                    </span>
                    <span className="font-mono text-slate-300">
                      D(q) = {(d_q * 100).toFixed(1)}% (θ₂ threshold = {(theta_2 * 100).toFixed(0)}%) {sqt && '· SQT=True'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d_q > theta_2 || sqt ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}`}>
                      {d_q > theta_2 || sqt ? '🌲 VECTORLESS' : '🎯 VECTOR'}
                    </span>
                  </div>
                  <div className="relative h-4 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                    <div
                      className="h-full transition-all duration-500 rounded-lg"
                      style={{
                        width: `${bar2Fill}%`,
                        background: (d_q > theta_2 || sqt) ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #4f46e5, #6366f1)'
                      }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                      style={{ left: `${bar2Marker}%` }}
                      title={`Threshold θ₂ = ${theta_2}`}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Direct Parametric Answer Card ────────────────────────────────────────────

function ParametricDirectAnswerCard({ answer }) {
  if (!answer) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border p-5 bg-amber-500/10 border-amber-500/30 shadow-xl backdrop-blur-md space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Direct Parametric Answer (No Document Retrieval Needed)</span>
        </div>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 font-bold">
          Zero-Retrieval LLM
        </span>
      </div>

      <div className="p-4 rounded-xl bg-slate-950/70 border border-amber-500/20 text-slate-100 text-sm leading-relaxed whitespace-pre-line">
        {answer}
      </div>

      <div className="flex items-start gap-2 text-xs text-amber-300/80 bg-amber-500/5 rounded-xl p-3 border border-amber-500/15">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Why did the pipelines below still run?</strong> RAG-Arena is an automated benchmarking arena. Even when a query does not require document retrieval, both Vector RAG and Vectorless RAG execute against the document so you can observe and evaluate how each pipeline handles out-of-domain queries.
        </p>
      </div>
    </motion.div>
  )
}

// ─── Pipeline Answer Panel ────────────────────────────────────────────────────

function AnswerPanel({ color, result, delay = 0, ddarPick = false }) {
  const isVector = color === 'vector'
  const label = isVector ? 'Vector RAG' : 'Vectorless RAG'
  const textColor = isVector ? 'text-indigo-400' : 'text-emerald-400'
  const borderColor = isVector ? 'border-indigo-500/30' : 'border-emerald-500/30'
  const chunksRef = useRef(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!result || result.error) return
    navigator.clipboard.writeText(result.answer)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={clsx(
        'flex-1 min-w-0 rounded-2xl border p-5 flex flex-col relative overflow-hidden bg-slate-900/80 shadow-xl backdrop-blur-md',
        borderColor
      )}
    >
      {ddarPick && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-indigo-600 to-sky-600 text-white text-center py-1 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 select-none shadow-sm">
          <Check className="w-3.5 h-3.5" /> Recommended by DDAR Router
        </div>
      )}

      {/* Header */}
      <div className={clsx('flex items-center justify-between', ddarPick ? 'mt-4' : '')}>
        <div className="flex items-center gap-2">
          {isVector ? <Zap className="w-4 h-4 text-indigo-400" /> : <TreePine className="w-4 h-4 text-emerald-400" />}
          <span className={isVector ? 'badge-vector' : 'badge-vectorless'}>{label}</span>
        </div>
        {result && !result.error && (
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>{result.latency_ms} ms</span>
            <span className="text-slate-600">·</span>
            <span>{(result.llm_prompt_tokens || 0) + (result.llm_completion_tokens || 0)} tokens</span>
            <span className="text-slate-600">·</span>
            <button
              onClick={handleCopy}
              className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Copy answer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Answer Body */}
      {result && (
        <div className="mt-4 space-y-4 flex-1 flex flex-col justify-between" ref={chunksRef}>
          {result.error ? (
            <div className="rounded-xl p-4 text-sm text-rose-300 border border-rose-500/20 bg-rose-500/10">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-400" /> Pipeline Exception
              </p>
              <p className="text-xs text-rose-300/80">{result.error}</p>
            </div>
          ) : (
            <div className="text-sm leading-relaxed text-slate-100 whitespace-pre-line bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              {result.answer}
            </div>
          )}

          {/* Diagnostic Context Metadata */}
          {result.chunks && result.chunks.length > 0 && (
            <details className="group mt-3 pt-3 border-t border-slate-800/80">
              <summary className={clsx('text-xs cursor-pointer select-none list-none flex items-center gap-1.5 font-medium transition-colors hover:text-white', textColor)}>
                <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                {result.chunks.length} Chunks Retrieved from pgvector
              </summary>
              <div className="mt-2.5 space-y-2">
                {result.chunks.map((c, i) => (
                  <div key={i} className="rounded-xl p-3 text-xs border border-slate-800 bg-slate-950/80">
                    <div className="flex justify-between text-slate-400 mb-1 font-mono text-[11px]">
                      <span>{c.page != null ? `Page ${c.page + 1}` : 'Document Excerpt'}</span>
                      <span className="text-indigo-400 font-semibold">Similarity: {(c.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <p className="text-slate-300 line-clamp-3 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Vectorless Navigation Path */}
          {result.navigation_path && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                <Route className="w-3.5 h-3.5" />
                <span>Tree Navigation Breadcrumb:</span>
              </div>
              <p className="font-mono text-slate-300 bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                {result.navigation_path}
              </p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Compare View ────────────────────────────────────────────────────────

export default function Compare() {
  const location = useLocation()
  const [selectedDocId, setSelectedDocId] = useState(location.state?.documentId || '')
  const [query, setQuery] = useState(location.state?.query || '')
  const [result, setResult] = useState(null)

  // Feedback voting states
  const [voted, setVoted] = useState(false)
  const [voting, setVoting] = useState(false)
  const [voteTally, setVoteTally] = useState(null)

  const { data: docsData } = useQuery({
    queryKey: ['documents', 'ready'],
    queryFn: () => listDocuments({ status: 'ready', session_id: getSessionId() }).then((r) => r.data),
  })
  const readyDocs = docsData?.items || []

  const compareMutation = useMutation({
    mutationFn: () => compareQuery(selectedDocId, query, null, getSessionId()).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data)
      setVoted(false)
      setVoteTally(null)
    },
  })

  useEffect(() => {
    if (location.state?.documentId && location.state?.query) {
      setSelectedDocId(location.state.documentId)
      setQuery(location.state.query)
      setResult(null)
      compareMutation.mutate()
    }
  }, [location.state])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedDocId || !query.trim()) return
    setResult(null)
    compareMutation.mutate()
  }

  const handleVote = async (winner) => {
    if (!result?.query_id) return
    setVoting(true)
    try {
      await submitVote(result.query_id, winner, getSessionId())
      setVoted(true)
      const tallyRes = await getVoteTally(result.query_id)
      setVoteTally(tallyRes.data)
    } catch (err) {
      console.error('Failed to submit vote:', err)
    } finally {
      setVoting(false)
    }
  }

  const handleExport = () => {
    if (!result) return
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `rag_arena_compare_${result.query_id}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const isLoading = compareMutation.isPending
  const hasResult = !!result
  const ddarRoute = result?.dual_axis_result?.route || result?.router?.recommended

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          Arena Comparison
        </h1>
        <p className="mt-1 text-sm text-slate-400 max-w-2xl leading-relaxed">
          Benchmark classical Vector RAG and from-scratch Vectorless RAG side-by-side. The Deterministic Dual-Axis Router analyzes your query first to determine retrieval necessity and recommend the optimal strategy.
        </p>
      </div>

      {/* Query Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border p-4 bg-slate-900/80 border-slate-800 shadow-2xl backdrop-blur-md"
      >
        <div className="flex gap-3 flex-col sm:flex-row">
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="input w-full sm:w-60 shrink-0 font-medium"
          >
            <option value="">Select a document…</option>
            {readyDocs.map((d) => (
              <option key={d.id} value={d.id}>{d.filename}</option>
            ))}
          </select>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about the document or test general knowledge…"
            className="input flex-1 min-w-0 text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
          />

          <button
            type="submit"
            disabled={!selectedDocId || !query.trim() || isLoading}
            className="btn-primary w-full sm:w-auto px-6 py-2.5 font-semibold"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Run</span>
          </button>
        </div>

        {compareMutation.isError && (
          <p className="mt-3 text-xs text-rose-400 flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {compareMutation.error?.response?.data?.detail || 'Request failed — check backend logs'}
          </p>
        )}
      </form>

      {/* Router Recommendation Banner */}
      <AnimatePresence>
        {hasResult && (
          <UnifiedRouterBanner router={result.router} ddar={result.dual_axis_result} />
        )}
      </AnimatePresence>

      {/* Direct Parametric Answer (if parametric) */}
      <AnimatePresence>
        {hasResult && (result.parametric_answer || ddarRoute === 'parametric') && (
          <ParametricDirectAnswerCard answer={result.parametric_answer} />
        )}
      </AnimatePresence>

      {/* Latency Comparison */}
      <AnimatePresence>
        {hasResult && result.vector && result.vectorless && !result.vector.error && !result.vectorless.error && (
          <LatencyBar
            vectorMs={result.vector.latency_ms}
            vectorlessMs={result.vectorless.latency_ms}
            handleExport={handleExport}
          />
        )}
      </AnimatePresence>

      {/* Side-by-Side Pipeline Arena Panels */}
      <div className="flex flex-col md:flex-row gap-5">
        {isLoading ? (
          <>
            <PanelSkeleton color="vector" />
            <PanelSkeleton color="vectorless" />
          </>
        ) : hasResult ? (
          <>
            <AnswerPanel
              color="vector"
              result={result.vector}
              ddarPick={ddarRoute === 'vector'}
            />
            <AnswerPanel
              color="vectorless"
              result={result.vectorless}
              delay={0.1}
              ddarPick={ddarRoute === 'vectorless'}
            />
          </>
        ) : (
          <div className="w-full py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
            <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-300">No Query Active</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Select a ready document from the dropdown above and enter a query to run the side-by-side RAG arena comparison.
            </p>
          </div>
        )}
      </div>

      {/* User Voting / Preference Telemetry */}
      <AnimatePresence>
        {hasResult && !isLoading && !result.vector?.error && !result.vectorless?.error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border p-5 bg-slate-900/80 border-slate-800 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4"
          >
            <div>
              <h4 className="font-semibold text-white flex items-center gap-2 text-sm">
                <ThumbsUp className="w-4 h-4 text-indigo-400" />
                Which pipeline gave the better answer?
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Cast your vote to log crowdsourced preference telemetry into the research database.
              </p>
            </div>

            {voted ? (
              <div className="text-sm font-semibold text-emerald-400 flex flex-col items-end gap-1">
                <span className="flex items-center gap-1.5"><Award className="w-4 h-4" /> Preference Recorded!</span>
                {voteTally && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    Global Tally: Vector {voteTally.vector_votes} | Vectorless {voteTally.vectorless_votes} | Ties {voteTally.tie_votes}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex gap-2.5 w-full md:w-auto shrink-0 justify-center">
                <button
                  onClick={() => handleVote('vector')}
                  disabled={voting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition-all"
                >
                  Vector RAG
                </button>
                <button
                  onClick={() => handleVote('vectorless')}
                  disabled={voting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all"
                >
                  Vectorless RAG
                </button>
                <button
                  onClick={() => handleVote('tie')}
                  disabled={voting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all"
                >
                  Tie
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
