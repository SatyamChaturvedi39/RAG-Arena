import { useState, useRef, useEffect } from 'react'
import { useSearchParams, Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Send,
  Loader2,
  Zap,
  TreePine,
  ChevronRight,
  ChevronDown,
  Upload,
  MessageSquare,
  SplitSquareHorizontal,
  Copy,
  Check,
  Download,
  ThumbsUp,
  Award,
  AlertCircle,
  Route
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PanelSkeleton({ color }) {
  const isVector = color === 'vector'
  const accentColor = isVector ? 'rgba(99,102,241,' : 'rgba(20,184,166,'
  return (
    <div
      className="flex-1 min-w-0 rounded-2xl border p-5 flex flex-col gap-4"
      style={{ background: `${accentColor}0.04)`, borderColor: `${accentColor}0.15)` }}
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
                background: isVector ? '#6366f1' : '#14b8a6',
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
      transition={{ delay: 0.3, duration: 0.4 }}
      className="rounded-2xl border p-4"
      style={{ background: 'rgba(15,22,35,0.5)', borderColor: 'rgba(30,45,66,0.6)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Latency comparison</span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">
            {fasterIsVector
              ? <span className="text-indigo-400 font-semibold">Vector RAG</span>
              : <span className="text-teal-400 font-semibold">Vectorless RAG</span>
            }
            {' '}was <span className="text-green-400 font-semibold">{speedup}× faster</span>
          </span>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
            title="Download full JSON diagnostics"
          >
            <Download className="w-3.5 h-3.5" /> JSON Export
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-indigo-400 w-20 shrink-0">Vector</span>
          <div className="flex-1 latency-bar-track">
            <div className="latency-bar-fill-vector" style={{ width: `${vPct}%` }} />
          </div>
          <span className="text-xs font-mono text-slate-400 w-16 text-right">{vectorMs}ms</span>
          {fasterIsVector && <span className="badge-winner text-xs">⚡ FASTER</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-teal-400 w-20 shrink-0">Vectorless</span>
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
  const accentColor = isVectorless ? 'rgba(20,184,166,' : 'rgba(99,102,241,'
  const textColor   = isVectorless ? '#2dd4bf' : '#818cf8'

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
            <span className={clsx('text-sm font-semibold', isVectorless ? 'text-teal-400' : 'text-indigo-400')}>
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

// ─── DDAR Router Decision Panel ───────────────────────────────────────────────

function RouterDecisionPanel({ ddar }) {
  const [open, setOpen] = useState(true) // Open by default
  if (!ddar) return null

  const routeValue = ddar.route || 'unknown'
  const routeConfig = {
    parametric: { color: '#E6A817', bg: 'rgba(230,168,23,0.08)', label: 'Parametric' },
    vector:     { color: '#1A6B8A', bg: 'rgba(26,107,138,0.08)',  label: 'Vector RAG' },
    vectorless: { color: '#2D6A4F', bg: 'rgba(45,106,79,0.08)',  label: 'Vectorless RAG' },
  }
  const rc = routeConfig[routeValue] || routeConfig.vector

  const s_q = ddar.s_q || 0
  const theta_1 = ddar.theta_1 || 11.5
  const d_q = ddar.d_q || 0
  const theta_2 = ddar.theta_2 || 0.15
  const sqt = ddar.sqt || false

  const bar1Fill = Math.min(100, Math.max(0, (s_q / 40) * 100))
  const bar1Marker = (theta_1 / 40) * 100
  const bar1Active = s_q >= theta_1

  const bar2Fill = Math.min(100, Math.max(0, d_q * 100))
  const bar2Marker = theta_2 * 100
  const bar2Active = d_q > theta_2 || sqt

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border overflow-hidden bg-white"
      style={{ borderColor: `${rc.color}40` }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
        style={{ background: rc.bg }}
      >
        <div className="flex items-center gap-2.5">
          <Route className="w-5 h-5 shrink-0" style={{ color: rc.color }} />
          <span className="text-sm font-semibold text-[var(--color-text)]">
            <span className="font-normal text-slate-500">🔀 DDAR recommends: </span>
            <span style={{ color: rc.color }}>{rc.label}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-muted)] font-medium">Why?</span>
          <ChevronDown
            className="w-4 h-4 text-slate-500 transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-6 border-t border-slate-200">
              {/* Axis 1 Gauge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[var(--color-primary)]">Axis 1 — Mean Token Surprisal</span>
                  <span className="font-mono text-slate-700">
                    S(q) = {s_q.toFixed(2)} bits (θ₁ = {theta_1} bits)
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bar1Active ? 'bg-[#2E86AB]/10 text-[#2E86AB]' : 'bg-slate-100 text-slate-500'}`}>
                    {bar1Active ? '✓ RETRIEVE' : '✗ SKIP RETRIEVAL'}
                  </span>
                </div>
                {/* Visual Gauge Bar */}
                <div className="relative h-6 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${bar1Fill}%`,
                      background: bar1Active ? '#2E86AB' : '#cbd5e1'
                    }}
                  />
                  {/* Threshold Marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{ left: `${bar1Marker}%` }}
                    title={`Threshold θ₁ = ${theta_1}`}
                  />
                  <div
                    className="absolute top-0 text-[8px] font-mono text-red-500 font-bold bg-white px-1 border border-red-200 rounded z-10 shadow-sm"
                    style={{ left: `calc(${bar1Marker}% - 14px)`, transform: 'translateY(12%)' }}
                  >
                    θ₁
                  </div>
                </div>
              </div>

              {/* Axis 2 Gauge */}
              {bar1Active && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-primary)]">Axis 2 — Entity Density</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${sqt ? 'bg-[#A23B72]/15 text-[#A23B72] font-bold' : 'bg-slate-100 text-slate-400'}`}>
                        SQT: {sqt ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <span className="font-mono text-slate-700">
                      D(q) = {d_q.toFixed(2)} (θ₂ = {theta_2})
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bar2Active ? 'bg-[#2D6A4F]/10 text-[#2D6A4F]' : 'bg-[#1A6B8A]/10 text-[#1A6B8A]'}`}>
                      {bar2Active ? '→ VECTORLESS' : '→ VECTOR'}
                    </span>
                  </div>
                  {/* Visual Gauge Bar */}
                  <div className="relative h-6 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${bar2Fill}%`,
                        background: bar2Active ? '#A23B72' : '#cbd5e1'
                      }}
                    />
                    {/* Threshold Marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                      style={{ left: `${bar2Marker}%` }}
                      title={`Threshold θ₂ = ${theta_2}`}
                    />
                    <div
                      className="absolute top-0 text-[8px] font-mono text-red-500 font-bold bg-white px-1 border border-red-200 rounded z-10 shadow-sm"
                      style={{ left: `calc(${bar2Marker}% - 14px)`, transform: 'translateY(12%)' }}
                    >
                      θ₂
                    </div>
                  </div>
                </div>
              )}

              {/* Monospace reason box */}
              <div className="rounded-xl px-4 py-3 bg-[#F4F7FA] border border-slate-200">
                <p className="text-xs font-mono text-slate-700 leading-relaxed">{ddar.reason || '—'}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function AnswerPanel({ color, result, delay = 0, ddarPick = false }) {
  const isVector   = color === 'vector'
  const label      = isVector ? 'Vector RAG' : 'Vectorless RAG'
  const accentColor = isVector ? 'rgba(26, 107, 138,' : 'rgba(45, 106, 79,'
  const textColor   = isVector ? '#1A6B8A' : '#2D6A4F'
  const chunksRef  = useRef(null)
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
      className={clsx('flex-1 min-w-0 rounded-2xl border flex flex-col relative overflow-hidden',
        result && !result.error && (isVector ? 'panel-vector loaded' : 'panel-vectorless loaded'),
        !result?.error && 'transition-all duration-300'
      )}
      style={{
        background: 'var(--color-surface)',
        borderColor: ddarPick ? 'var(--color-accent)' : 'var(--color-border)',
        boxShadow: ddarPick ? '0 10px 25px -5px rgba(26, 107, 138, 0.15)' : 'none',
        paddingTop: ddarPick ? '2.5rem' : '1.25rem',
        paddingLeft: '1.25rem',
        paddingRight: '1.25rem',
        paddingBottom: '1.25rem',
        gap: '1rem',
      }}
    >
      {ddarPick && (
        <div className="absolute top-0 left-0 right-0 bg-[var(--color-accent)] text-white text-center py-1 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 select-none">
          <Check className="w-3.5 h-3.5" /> DDAR Pick
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={isVector ? 'badge-vector' : 'badge-vectorless'}>{label}</span>
        </div>
        {result && !result.error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums"
          >
            <span>{result.latency_ms}ms</span>
            <span className="text-slate-700">·</span>
            <div 
              className="flex flex-col items-end gap-1 cursor-help" 
              title={`Prompt: ${result.llm_prompt_tokens || 0} | Completion: ${result.llm_completion_tokens || 0}`}
            >
              <span>{(result.llm_prompt_tokens || 0) + (result.llm_completion_tokens || 0)} tok</span>
              <div className="flex w-12 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(63,63,70,0.8)' }}>
                <div className="bg-zinc-500" style={{ width: `${((result.llm_prompt_tokens || 0) / Math.max(1, (result.llm_prompt_tokens || 0) + (result.llm_completion_tokens || 0))) * 100}%` }} />
                <div style={{ background: isVector ? '#818cf8' : '#2dd4bf', width: `${((result.llm_completion_tokens || 0) / Math.max(1, (result.llm_prompt_tokens || 0) + (result.llm_completion_tokens || 0))) * 100}%` }} />
              </div>
            </div>
            <span className="text-slate-700">·</span>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </motion.div>
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
            <p className="text-sm leading-relaxed text-zinc-200 answer-text whitespace-pre-line">{result.answer}</p>
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
                    style={{ background: 'rgba(24, 24, 27, 0.8)', borderColor: 'rgba(39, 39, 42, 0.7)' }}>
                    <div className="flex justify-between text-zinc-500 mb-1.5 font-mono">
                      <span>{c.page != null ? `Page ${c.page + 1}` : '—'}</span>
                      <span style={{ color: textColor }}>{(c.similarity * 100).toFixed(1)}% match</span>
                    </div>
                    <p className="text-zinc-300 line-clamp-3 leading-relaxed">{c.text}</p>
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
                style={{ background: 'rgba(24, 24, 27, 0.8)', borderColor: 'rgba(39, 39, 42, 0.7)' }}>
                <p className="text-xs font-mono text-zinc-400 leading-relaxed">{result.navigation_path}</p>
                {result.fallback_used && (
                  <p className="mt-2 text-xs text-amber-500/80">⚠ Fallback mode — low-structure document</p>
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
  const location = useLocation()
  const preselectedDocId = searchParams.get('doc') || location.state?.documentId

  const [selectedDocId, setSelectedDocId] = useState(preselectedDocId || '')
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

  // Auto-run if deep linked via query replay (History page)
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
      
      // Fetch fresh tallies
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Compare</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          The DDAR router analyses your query first, then both pipelines run so you can see which one was recommended — and whether it gave the better answer.
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
        <div className="flex gap-3 flex-col sm:flex-row">
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="input w-full sm:w-48 shrink-0"
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
            className="btn-primary flex items-center justify-center gap-2 shrink-0 px-5 w-full sm:w-auto"
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
            Run
          </button>
        </div>

        {compareMutation.isError && (
          <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
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
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Vector RAG running…</span>
            </div>
            <span className="text-slate-700">·</span>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <TreePine className="w-3.5 h-3.5 text-teal-400" />
              <span>Vectorless RAG navigating tree…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Router badge */}
      <AnimatePresence>
        {result?.router && <RouterBadge router={result.router} />}
      </AnimatePresence>

      {/* DDAR Router Decision Panel */}
      <AnimatePresence>
        {hasResult && result?.dual_axis_result && (
          <RouterDecisionPanel ddar={result.dual_axis_result} />
        )}
      </AnimatePresence>

      {/* Latency bar */}
      <AnimatePresence>
        {hasResult && result.vector && result.vectorless &&
          !result.vector.error && !result.vectorless.error && (
          <LatencyBar
            vectorMs={result.vector.latency_ms}
            vectorlessMs={result.vectorless.latency_ms}
            handleExport={handleExport}
          />
        )}
      </AnimatePresence>

      {/* User voting / Crowdsourced Feedback */}
      <AnimatePresence>
        {hasResult && !isLoading && !result.vector?.error && !result.vectorless?.error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="card p-5 border-indigo-500/20 bg-indigo-500/5 flex flex-col md:flex-row items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <h4 className="font-semibold text-zinc-100 flex items-center gap-1.5 text-sm">
                <ThumbsUp className="w-4 h-4 text-indigo-400" />
                Which pipeline gave the better answer?
              </h4>
              <p className="text-xs text-zinc-400">
                Help us evaluate relative quality. Your preference logs crowdsourced research telemetry.
              </p>
            </div>

            {voted ? (
              <div className="text-sm font-semibold text-emerald-400 flex flex-col items-end gap-1">
                <span className="flex items-center gap-1.5"><Award className="w-4 h-4" /> Preference Recorded!</span>
                {voteTally && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Tally: Vector {voteTally.vector_votes} | Vectorless {voteTally.vectorless_votes} | Ties {voteTally.tie_votes}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex gap-2 w-full md:w-auto shrink-0 justify-center">
                <button
                  onClick={() => handleVote('vector')}
                  disabled={voting}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 border-indigo-500/20 hover:border-indigo-500/40 hover:text-indigo-400 w-full md:w-auto justify-center"
                >
                  Vector RAG
                </button>
                <button
                  onClick={() => handleVote('vectorless')}
                  disabled={voting}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 border-teal-500/20 hover:border-teal-500/40 hover:text-teal-400 w-full md:w-auto justify-center"
                >
                  Vectorless RAG
                </button>
                <button
                  onClick={() => handleVote('tie')}
                  disabled={voting}
                  className="btn-secondary text-xs px-3 py-1.5 hover:border-blue-500/40 hover:text-blue-400 w-full md:w-auto justify-center"
                >
                  It's a Tie
                </button>
              </div>
            )}
          </motion.div>
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
            className="flex flex-col md:flex-row gap-4"
          >
            <PanelSkeleton color="vector" />
            <PanelSkeleton color="vectorless" />
          </motion.div>
        )}
        {hasResult && !isLoading && (
          <motion.div key="results" className="flex flex-col md:flex-row gap-4">
            <AnswerPanel
              color="vector"
              result={result?.vector}
              delay={0}
              ddarPick={result?.dual_axis_result?.route === 'vector'}
            />
            <AnswerPanel
              color="vectorless"
              result={result?.vectorless}
              delay={0.08}
              ddarPick={result?.dual_axis_result?.route === 'vectorless'}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt state — docs exist but no query yet */}
      {!hasResult && !isLoading && readyDocs.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          {[
            { color: 'vector',     label: 'Vector RAG',     sub: 'Cosine similarity over chunk embeddings',  accent: 'rgba(99,102,241,' },
            { color: 'vectorless', label: 'Vectorless RAG', sub: 'LLM-guided hierarchical tree navigation',  accent: 'rgba(20,184,166,' },
          ].map(({ color, label, sub, accent }) => (
            <div
              key={color}
              className="flex-1 rounded-2xl border p-6 flex flex-col items-center justify-center gap-2 text-center"
              style={{ background: `${accent}0.03)`, borderColor: `${accent}0.14)`, borderStyle: 'dashed' }}
            >
              <span className={color === 'vector' ? 'badge-vector' : 'badge-vectorless'}>{label}</span>
              <p className="text-xs text-slate-600">{sub}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Empty state — how it works */}
      {!hasResult && !isLoading && readyDocs.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border py-14 px-8"
          style={{ background: 'rgba(15,22,35,0.4)', borderColor: 'rgba(30,45,66,0.5)', borderStyle: 'dashed' }}
        >
          <p className="text-center text-sm text-slate-500 mb-10">How it works</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0">
            {[
              { Icon: Zap,                   step: '1', label: 'DDAR Analyses',     sub: 'Surprisal and entity density computed from your query text — no model call.' },
              { Icon: Route,                 step: '2', label: 'Route Decided',     sub: 'Parametric, Vector, or Vectorless selected in under 1ms.' },
              { Icon: SplitSquareHorizontal, step: '3', label: 'Both Pipelines Run', sub: 'Results shown side by side. You judge which answer wins.' },
            ].map(({ Icon, step, label, sub }, i) => (
              <div key={step} className="flex sm:flex-col items-center sm:items-center gap-4 sm:gap-0 flex-1 min-w-0">
                {i > 0 && (
                  <ChevronRight className="w-4 h-4 text-slate-700 shrink-0 hidden sm:block mb-6 -ml-2 -mr-2 mt-[-20px]" />
                )}
                <div className="flex sm:flex-col items-center gap-4 sm:gap-3 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)' }}
                  >
                    <Icon className="w-5 h-5 text-accent-400" />
                  </div>
                  <div className="sm:text-center">
                    <p className="text-sm font-medium text-slate-300">{label}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-[160px] sm:mx-auto">{sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 btn-primary text-sm px-5 py-2"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload a PDF to start
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  )
}
