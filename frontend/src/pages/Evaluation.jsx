import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { startEvalRun, listEvalRuns, getEvalRun } from '../api/client'
import clsx from 'clsx'

function StatusIcon({ status }) {
  if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-400" />
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-400" />
  return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
}

function MetricCell({ value, isWinner }) {
  if (value == null) return <span className="text-slate-600">—</span>
  return (
    <span className={clsx('font-mono text-sm', isWinner ? 'text-green-400 font-medium' : 'text-slate-300')}>
      {typeof value === 'number' && value <= 1 ? (value * 100).toFixed(1) + '%' : value}
    </span>
  )
}

function EvalRunCard({ run, onSelect, isSelected }) {
  return (
    <button
      onClick={() => onSelect(run.id)}
      className={clsx(
        'card w-full text-left transition-colors hover:border-surface-500',
        isSelected && 'border-accent-500/50 bg-accent-500/5',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={run.status} />
          <span className="font-medium text-sm capitalize">{run.dataset_name}</span>
          {run.total_questions && (
            <span className="text-xs text-slate-500">{run.total_questions} questions</span>
          )}
        </div>
        <span className="text-xs text-slate-600">
          {new Date(run.run_at).toLocaleDateString()}
        </span>
      </div>

      {run.status === 'completed' && (
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Vector F1</span>
            <MetricCell value={run.vector_f1_mean} isWinner={run.vector_f1_mean > run.vectorless_f1_mean} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Vectorless F1</span>
            <MetricCell value={run.vectorless_f1_mean} isWinner={run.vectorless_f1_mean > run.vector_f1_mean} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Router acc.</span>
            <MetricCell value={run.router_accuracy} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Vector p50</span>
            <span className="font-mono text-sm text-slate-300">{run.vector_latency_p50}ms</span>
          </div>
        </div>
      )}
    </button>
  )
}

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eval-runs'] })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Evaluation</h1>
        <p className="mt-1 text-sm text-slate-400">
          Run the FinanceBench evaluation suite to compare pipeline accuracy at scale.
        </p>
      </div>

      {/* Start run form */}
      <div className="card flex items-end gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Dataset</label>
          <select
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-slate-200"
          >
            <option value="financebench">FinanceBench</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Max questions</label>
          <input
            type="number"
            min={5}
            max={150}
            value={maxQ}
            onChange={(e) => setMaxQ(Number(e.target.value))}
            className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-slate-200 w-24"
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
        <p className="text-xs text-slate-600">
          ⚠ Each question uses ~7 Groq API calls. 50 questions takes ~10 min due to rate limits.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Run list */}
        <div className="w-72 space-y-2 shrink-0">
          <h2 className="text-xs text-slate-500 uppercase tracking-wider">Past runs</h2>
          {runsLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          ) : runs.length === 0 ? (
            <p className="text-sm text-slate-600">No runs yet.</p>
          ) : (
            runs.map((run) => (
              <EvalRunCard
                key={run.id}
                run={run}
                onSelect={setSelectedRunId}
                isSelected={run.id === selectedRunId}
              />
            ))
          )}
        </div>

        {/* Per-question detail */}
        {runDetail && (
          <div className="flex-1 min-w-0">
            <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
              Question results ({runDetail.question_results?.length || 0})
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {(runDetail.question_results || []).map((qr, i) => (
                <div key={i} className="card text-xs space-y-2">
                  <p className="font-medium text-slate-200">{qr.query_text}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(qr.pipeline_results || []).map((pr) => (
                      <div key={pr.pipeline} className="space-y-1">
                        <span className={pr.pipeline === 'vector' ? 'badge-vector' : 'badge-vectorless'}>
                          {pr.pipeline === 'vector' ? 'Vector' : 'Vectorless'}
                        </span>
                        <p className="text-slate-300 mt-1">{pr.answer}</p>
                        {pr.f1_score != null && (
                          <p className="text-slate-500">F1: {(pr.f1_score * 100).toFixed(1)}%</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
