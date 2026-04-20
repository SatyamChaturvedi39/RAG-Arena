import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Loader2, CheckCircle, XCircle, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { startEvalRun, listEvalRuns, getEvalRun } from '../api/client'
import clsx from 'clsx'

// ─── Animated count-up hook ───────────────────────────────────────────────────

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target == null) return
    setValue(0)
    const startTime = performance.now()
    const easeOut = (t) => 1 - Math.pow(1 - t, 3)
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1)
      setValue(target * easeOut(progress))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return value
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, unit = '%', color, delay = 0 }) {
  const animated = useCountUp(value != null ? value * 100 : null)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className="metric-card flex flex-col gap-1"
      style={{
        borderColor: color ? `${color}0.25)` : undefined,
        boxShadow: color ? `0 0 24px ${color}0.07)` : undefined,
      }}
    >
      <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: color ? color.replace('rgba(', 'rgb(').replace(',', '').slice(0, -1) + ')' : '#e2e8f0' }}>
        {value != null ? `${animated.toFixed(1)}${unit}` : '—'}
      </p>
    </motion.div>
  )
}

// ─── Custom Recharts tooltip ──────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border p-3 text-xs shadow-xl"
      style={{ background: 'rgba(15,22,35,0.97)', borderColor: 'rgba(30,45,66,0.9)' }}>
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-mono font-semibold" style={{ color: p.fill }}>
            {p.value.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Run detail panel ─────────────────────────────────────────────────────────

function RunDetail({ runDetail }) {
  const run = runDetail?.run
  const questions = runDetail?.question_results || []
  const qRef = useRef(null)

  useEffect(() => {
    if (!questions.length) return
    const items = qRef.current?.querySelectorAll('.q-item')
    if (items?.length) {
      gsap.from(items, { opacity: 0, y: 10, stagger: 0.05, duration: 0.35, ease: 'power2.out' })
    }
  }, [questions.length])

  if (!run) return null

  const chartData = run.status === 'completed' ? [
    {
      metric: 'F1 Score',
      Vector:     +(( run.vector_f1_mean    || 0) * 100).toFixed(1),
      Vectorless: +((run.vectorless_f1_mean || 0) * 100).toFixed(1),
    },
    {
      metric: 'Exact Match',
      Vector:     +((run.vector_em_rate    || 0) * 100).toFixed(1),
      Vectorless: +((run.vectorless_em_rate || 0) * 100).toFixed(1),
    },
    {
      metric: 'Router Acc.',
      Vector:     +((run.router_accuracy || 0) * 100).toFixed(1),
      Vectorless: +((run.router_accuracy || 0) * 100).toFixed(1),
    },
  ] : []

  return (
    <motion.div
      key={run.id}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex-1 min-w-0 space-y-5"
    >
      {/* Status header */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-white capitalize">{run.dataset_name}</h2>
        <span className={clsx(
          'text-xs px-2 py-0.5 rounded-full font-medium',
          run.status === 'completed' && 'bg-green-500/10 text-green-400 border border-green-500/20',
          run.status === 'running'   && 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
          run.status === 'failed'    && 'bg-red-500/10 text-red-400 border border-red-500/20',
        )}>
          {run.status}
        </span>
        <span className="text-xs text-slate-600 ml-auto">
          {new Date(run.run_at).toLocaleString()}
        </span>
      </div>

      {/* Metric cards */}
      {run.status === 'completed' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Vector F1"     value={run.vector_f1_mean}     color="rgba(59,130,246,"  delay={0}    />
          <MetricCard label="Vectorless F1" value={run.vectorless_f1_mean} color="rgba(139,92,246,"  delay={0.07} />
          <MetricCard label="Router Acc."   value={run.router_accuracy}    color="rgba(99,102,241,"  delay={0.14} />
          <MetricCard label="Questions"     value={null}                   unit="" delay={0.21}
            /* override to show integer */
          >
            <p className="text-2xl font-bold text-slate-200">{run.total_questions}</p>
          </MetricCard>
        </div>
      )}

      {/* Bar chart */}
      {run.status === 'completed' && chartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="card p-4"
        >
          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-4">
            Pipeline comparison
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
              <XAxis
                dataKey="metric"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(30,45,66,0.7)' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(30,45,66,0.4)' }} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }}
                formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
              />
              <Bar dataKey="Vector"     radius={[4,4,0,0]} maxBarSize={40}>
                {chartData.map((_, i) => <Cell key={i} fill="#3b82f6" />)}
              </Bar>
              <Bar dataKey="Vectorless" radius={[4,4,0,0]} maxBarSize={40}>
                {chartData.map((_, i) => <Cell key={i} fill="#8b5cf6" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Latency comparison */}
          {run.vector_latency_p50 && run.vectorless_latency_p50 && (
            <div className="mt-4 pt-4 border-t border-surface-600 space-y-2">
              <p className="text-xs text-slate-500 mb-3">Latency (p50 · p95)</p>
              {[
                { label: 'Vector',     p50: run.vector_latency_p50,     p95: run.vector_latency_p95,     color: '#3b82f6', fill: 'latency-bar-fill-vector' },
                { label: 'Vectorless', p50: run.vectorless_latency_p50, p95: run.vectorless_latency_p95, color: '#8b5cf6', fill: 'latency-bar-fill-vectorless' },
              ].map(({ label, p50, p95, color, fill }) => {
                const max = Math.max(run.vector_latency_p95 || 0, run.vectorless_latency_p95 || 0)
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs w-20 shrink-0" style={{ color }}>{label}</span>
                    <div className="flex-1 latency-bar-track">
                      <div className={fill} style={{ width: `${(p50 / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-28 text-right shrink-0">
                      {p50}ms · {p95 ?? '—'}ms
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* In-progress state */}
      {run.status === 'running' && (
        <div className="card flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="w-8 h-8 text-accent-400 animate-spin" />
          <div className="text-center">
            <p className="text-sm text-slate-300 font-medium">Evaluation running…</p>
            <p className="text-xs text-slate-600 mt-1">
              Each question uses ~7 Groq API calls. This may take several minutes.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {run.status === 'failed' && run.notes && (
        <div className="card border-red-500/20">
          <p className="text-xs text-red-400 font-medium mb-1">Run failed</p>
          <p className="text-xs text-red-400/70 font-mono">{run.notes}</p>
        </div>
      )}

      {/* Per-question results */}
      {questions.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-3">
            Question results ({questions.length})
          </p>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1" ref={qRef}>
            {questions.map((qr, i) => (
              <QuestionCard key={i} qr={qr} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function QuestionCard({ qr }) {
  const [open, setOpen] = useState(false)
  const vr  = qr.pipeline_results?.find(p => p.pipeline === 'vector')
  const vlr = qr.pipeline_results?.find(p => p.pipeline === 'vectorless')
  const vF1  = vr?.f1_score
  const vlF1 = vlr?.f1_score
  const vWins  = vF1 != null && vlF1 != null && vF1 > vlF1
  const vlWins = vF1 != null && vlF1 != null && vlF1 > vF1

  return (
    <div className="q-item card py-3 px-4 cursor-pointer hover:border-surface-500 transition-colors"
      onClick={() => setOpen(o => !o)}>
      <div className="flex items-start gap-2">
        <ChevronRight className={clsx('w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0 transition-transform', open && 'rotate-90')} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-300 leading-relaxed">{qr.query_text}</p>
          {!open && vF1 != null && (
            <div className="flex gap-3 mt-1.5">
              <span className={clsx('text-xs font-mono', vWins ? 'text-vector-400' : 'text-slate-500')}>
                Vector: {(vF1 * 100).toFixed(1)}%
              </span>
              <span className={clsx('text-xs font-mono', vlWins ? 'text-vectorless-400' : 'text-slate-500')}>
                Vectorless: {(vlF1 * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-surface-600">
              {[
                { pr: vr,  label: 'Vector',     f1: vF1,  wins: vWins,  color: 'text-vector-400',     badge: 'badge-vector' },
                { pr: vlr, label: 'Vectorless',  f1: vlF1, wins: vlWins, color: 'text-vectorless-400', badge: 'badge-vectorless' },
              ].map(({ pr, label, f1, wins, color, badge }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={badge}>{label}</span>
                    {f1 != null && (
                      <span className={clsx('text-xs font-mono font-semibold', wins ? 'text-green-400' : 'text-slate-500')}>
                        F1: {(f1 * 100).toFixed(1)}%{wins && ' ✓'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{pr?.answer || '—'}</p>
                  {pr?.latency_ms && (
                    <p className="text-xs font-mono text-slate-600">{pr.latency_ms}ms</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Run card ─────────────────────────────────────────────────────────────────

function StatusIcon({ status }) {
  if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
  if (status === 'failed')    return <XCircle     className="w-4 h-4 text-red-400 shrink-0" />
  return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin shrink-0" />
}

function EvalRunCard({ run, onSelect, isSelected }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onClick={() => onSelect(run.id)}
      className={clsx(
        'card w-full text-left transition-all hover:border-surface-500',
        isSelected && 'border-accent-500/50 bg-accent-500/5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon status={run.status} />
          <span className="font-medium text-sm capitalize truncate">{run.dataset_name}</span>
          {run.total_questions && (
            <span className="text-xs text-slate-500 shrink-0">{run.total_questions}q</span>
          )}
        </div>
        <span className="text-xs text-slate-600 shrink-0">
          {new Date(run.run_at).toLocaleDateString()}
        </span>
      </div>

      {run.status === 'completed' && (
        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Vector F1</span>
            <span className={clsx('font-mono', run.vector_f1_mean > run.vectorless_f1_mean ? 'text-vector-400 font-semibold' : 'text-slate-400')}>
              {run.vector_f1_mean != null ? (run.vector_f1_mean * 100).toFixed(1) + '%' : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">V-less F1</span>
            <span className={clsx('font-mono', run.vectorless_f1_mean > run.vector_f1_mean ? 'text-vectorless-400 font-semibold' : 'text-slate-400')}>
              {run.vectorless_f1_mean != null ? (run.vectorless_f1_mean * 100).toFixed(1) + '%' : '—'}
            </span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-slate-600">Router accuracy</span>
            <span className="font-mono text-accent-400">
              {run.router_accuracy != null ? (run.router_accuracy * 100).toFixed(1) + '%' : '—'}
            </span>
          </div>
        </div>
      )}
    </motion.button>
  )
}

// ─── Evaluation page ──────────────────────────────────────────────────────────

export default function Evaluation() {
  const queryClient = useQueryClient()
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [dataset, setDataset] = useState('financebench')
  const [maxQ, setMaxQ] = useState(50)

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['eval-runs'],
    queryFn: () => listEvalRuns().then((r) => r.data),
    refetchInterval: 10_000,
  })

  const { data: runDetail } = useQuery({
    queryKey: ['eval-run', selectedRunId],
    queryFn: () => getEvalRun(selectedRunId).then((r) => r.data),
    enabled: !!selectedRunId,
    refetchInterval: 5_000,
  })

  const startMutation = useMutation({
    mutationFn: () => startEvalRun(dataset, maxQ).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['eval-runs'] })
      setSelectedRunId(data.eval_run_id)
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Evaluation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Benchmark both pipelines on QA datasets. See which retrieval strategy wins — and when.
        </p>
      </div>

      {/* Start run form */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'rgba(15,22,35,0.65)', borderColor: 'rgba(30,45,66,0.7)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Dataset</label>
            <select
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              className="input"
            >
              <option value="financebench">FinanceBench</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Max questions</label>
            <input
              type="number" min={5} max={150} value={maxQ}
              onChange={(e) => setMaxQ(Number(e.target.value))}
              className="input w-24"
            />
          </div>
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Start run
          </button>
          <p className="text-xs text-slate-600 max-w-xs">
            ⚠ ~7 Groq API calls per question · 50 questions ≈ 10 min
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-5">
        {/* Run list */}
        <div className="w-64 shrink-0 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Past runs</p>
          {runsLoading ? (
            <div className="space-y-2">
              {[0,1].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}
            </div>
          ) : runs.length === 0 ? (
            <div
              className="rounded-2xl border py-8 text-center"
              style={{ borderColor: 'rgba(30,45,66,0.5)', borderStyle: 'dashed' }}
            >
              <p className="text-xs text-slate-600">No runs yet.</p>
              <p className="text-xs text-slate-700 mt-1">Start a run above.</p>
            </div>
          ) : (
            <AnimatePresence>
              {runs.map((run) => (
                <EvalRunCard
                  key={run.id}
                  run={run}
                  onSelect={setSelectedRunId}
                  isSelected={run.id === selectedRunId}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {runDetail ? (
              <RunDetail key={selectedRunId} runDetail={runDetail} />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-64 flex flex-col items-center justify-center rounded-2xl border"
                style={{ borderColor: 'rgba(30,45,66,0.5)', borderStyle: 'dashed' }}
              >
                <p className="text-sm text-slate-600">Select a run to see details</p>
                <p className="text-xs text-slate-700 mt-1">or start a new one above</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
