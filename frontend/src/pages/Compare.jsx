import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Send, Loader2 } from 'lucide-react'
import { compareQuery, listDocuments } from '../api/client'
import clsx from 'clsx'

// ─── Router badge ─────────────────────────────────────────────────────────────

function RouterBadge({ router }) {
  if (!router) return null
  const isVectorless = router.recommended === 'vectorless'
  const color = isVectorless ? 'rgba(139, 92, 246,' : 'rgba(59, 130, 246,'

  return (
    <div
      className="rounded-2xl p-4 border"
      style={{
        background: `${color}0.05)`,
        borderColor: `${color}0.18)`,
        boxShadow: `0 0 30px ${color}0.04)`,
      }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-medium">
            Router recommendation
          </p>
          <div className="flex items-center gap-3 mb-2">
            <span
              className={clsx('text-sm font-semibold', isVectorless ? 'text-vectorless-400' : 'text-vector-400')}
            >
              {isVectorless ? 'Vectorless RAG' : 'Vector RAG'}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ background: `${color}0.10)`, color: isVectorless ? '#a78bfa' : '#60a5fa' }}
            >
              {(router.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">{router.reasoning}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Answer panel ─────────────────────────────────────────────────────────────

function AnswerPanel({ color, result, isLoading }) {
  const isVector = color === 'vector'
  const label = isVector ? 'Vector RAG' : 'Vectorless RAG'
  const accentColor = isVector ? 'rgba(59, 130, 246,' : 'rgba(139, 92, 246,'
  const textColor = isVector ? '#60a5fa' : '#a78bfa'

  return (
    <div
      className="flex-1 min-w-0 rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-300"
      style={{
        background: `${accentColor}0.03)`,
        borderColor: `${accentColor}0.18)`,
        boxShadow: `0 0 40px ${accentColor}0.05), inset 0 1px 0 ${accentColor}0.06)`,
      }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <span className={isVector ? 'badge-vector' : 'badge-vectorless'}>{label}</span>
        {result && !result.error && (
          <span className="text-xs text-slate-600 font-mono tabular-nums">
            {result.latency_ms}ms · {(result.llm_prompt_tokens || 0) + (result.llm_completion_tokens || 0)} tok
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2.5 text-slate-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: textColor }} />
          <span>Running pipeline…</span>
        </div>
      )}

      {/* Answer */}
      {result && !isLoading && (
        <div className="space-y-4">
          {result.error ? (
            <p className="text-sm text-red-400">{result.error}</p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-200">{result.answer}</p>
          )}

          {/* Vector: chunk sources */}
          {result.chunks && result.chunks.length > 0 && (
            <details className="group">
              <summary
                className="text-xs cursor-pointer select-none list-none flex items-center gap-1.5 transition-colors"
                style={{ color: textColor }}
              >
                <span className="text-slate-600 group-open:rotate-90 transition-transform inline-block">›</span>
                {result.chunks.length} chunks retrieved
              </summary>
              <div className="mt-2 space-y-2">
                {result.chunks.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3 text-xs"
                    style={{ background: 'rgba(15, 22, 35, 0.8)', border: '1px solid rgba(30, 45, 66, 0.7)' }}
                  >
                    <div className="flex justify-between text-slate-600 mb-1.5 font-mono">
                      <span>{c.page != null ? `Page ${c.page + 1}` : '—'}</span>
                      <span style={{ color: textColor }}>{(c.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <p className="text-slate-400 line-clamp-3 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Vectorless: navigation path */}
          {result.navigation_path && (
            <details className="group">
              <summary
                className="text-xs cursor-pointer select-none list-none flex items-center gap-1.5"
                style={{ color: textColor }}
              >
                <span className="text-slate-600 group-open:rotate-90 transition-transform inline-block">›</span>
                Navigation · {result.nodes_visited_count} LLM call{result.nodes_visited_count !== 1 ? 's' : ''}
              </summary>
              <div
                className="mt-2 rounded-xl p-3"
                style={{ background: 'rgba(15, 22, 35, 0.8)', border: '1px solid rgba(30, 45, 66, 0.7)' }}
              >
                <p className="text-xs font-mono text-slate-400">{result.navigation_path}</p>
                {result.fallback_used && (
                  <p className="mt-1.5 text-xs text-yellow-500">⚠ Fallback mode — low-structure document</p>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
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

  return (
    <div className="space-y-6">
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
          background: 'rgba(15, 22, 35, 0.65)',
          borderColor: 'rgba(30, 45, 66, 0.7)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex gap-3">
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="input w-56 shrink-0"
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
            placeholder="Ask a question about the document…"
            className="input flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
          />

          <button
            type="submit"
            disabled={!selectedDocId || !query.trim() || compareMutation.isPending}
            className="btn-primary flex items-center gap-2 shrink-0 px-5"
          >
            {compareMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
            Run
          </button>
        </div>

        {compareMutation.isError && (
          <p className="mt-3 text-xs text-red-400">
            {compareMutation.error?.response?.data?.detail || 'Request failed'}
          </p>
        )}
      </form>

      {/* Router badge */}
      {result?.router && <RouterBadge router={result.router} />}

      {/* Side-by-side answer panels */}
      {(result || compareMutation.isPending) && (
        <div className="flex gap-4">
          <AnswerPanel color="vector" result={result?.vector} isLoading={compareMutation.isPending} />
          <AnswerPanel color="vectorless" result={result?.vectorless} isLoading={compareMutation.isPending} />
        </div>
      )}

      {!result && !compareMutation.isPending && readyDocs.length === 0 && (
        <div
          className="rounded-2xl border py-16 text-center"
          style={{ background: 'rgba(15, 22, 35, 0.4)', borderColor: 'rgba(30, 45, 66, 0.5)', borderStyle: 'dashed' }}
        >
          <p className="text-slate-600 text-sm">
            No documents ready.{' '}
            <a href="/" className="text-accent-400 hover:text-accent-300 transition-colors">
              Upload a PDF
            </a>{' '}
            to get started.
          </p>
        </div>
      )}
    </div>
  )
}
