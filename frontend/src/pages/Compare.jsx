import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Send, Loader2, RotateCcw } from 'lucide-react'
import { compareQuery, listDocuments } from '../api/client'
import clsx from 'clsx'

// ─── Sub-components (full implementation comes in Week 2 Days 17-18) ─────────

function RouterBadge({ router }) {
  if (!router) return null
  const isVectorless = router.recommended === 'vectorless'
  return (
    <div className="card border-accent-500/30 bg-accent-500/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Router recommendation</p>
          <div className="flex items-center gap-2">
            <span className={clsx('font-medium', isVectorless ? 'text-vectorless-400' : 'text-vector-400')}>
              {router.recommended === 'vectorless' ? 'Vectorless RAG' : 'Vector RAG'}
            </span>
            <span className="text-xs text-slate-500">
              {(router.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-400">{router.reasoning}</p>
        </div>
      </div>
    </div>
  )
}

function AnswerPanel({ title, result, color, isLoading }) {
  const colorClass = color === 'vector' ? 'border-vector-500/30' : 'border-vectorless-500/30'
  const badgeClass = color === 'vector' ? 'badge-vector' : 'badge-vectorless'
  const label = color === 'vector' ? 'Vector RAG' : 'Vectorless RAG'

  return (
    <div className={clsx('card flex-1 min-w-0', colorClass)}>
      <div className="flex items-center justify-between mb-4">
        <span className={badgeClass}>{label}</span>
        {result && (
          <span className="text-xs text-slate-500 font-mono">
            {result.latency_ms}ms · {result.llm_prompt_tokens + result.llm_completion_tokens} tok
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Running…
        </div>
      )}

      {result && !isLoading && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-200">{result.answer}</p>

          {/* Vector: show retrieved chunks */}
          {result.chunks && result.chunks.length > 0 && (
            <details className="text-xs">
              <summary className="text-slate-500 cursor-pointer hover:text-slate-400">
                {result.chunks.length} chunks retrieved
              </summary>
              <div className="mt-2 space-y-2">
                {result.chunks.map((c, i) => (
                  <div key={i} className="bg-surface-700 rounded-lg p-3">
                    <div className="flex justify-between text-slate-500 mb-1">
                      <span>{c.page != null ? `Page ${c.page + 1}` : 'Unknown page'}</span>
                      <span>similarity {(c.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <p className="text-slate-300 line-clamp-3">{c.text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Vectorless: show navigation path */}
          {result.navigation_path && (
            <details className="text-xs">
              <summary className="text-slate-500 cursor-pointer hover:text-slate-400">
                Navigation path ({result.nodes_visited_count} LLM calls)
              </summary>
              <div className="mt-2 bg-surface-700 rounded-lg p-3">
                <p className="text-slate-300 font-mono">{result.navigation_path}</p>
                {result.fallback_used && (
                  <p className="mt-1 text-yellow-500">⚠ Fallback mode used (low-structure document)</p>
                )}
              </div>
            </details>
          )}

          {result.error && (
            <p className="text-xs text-red-400">Error: {result.error}</p>
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
      <div>
        <h1 className="text-2xl font-semibold text-white">Compare</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ask a question and see Vector RAG and Vectorless RAG answer side by side.
        </p>
      </div>

      {/* Query form */}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="flex gap-3">
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-slate-200 w-64 shrink-0"
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
            className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-500"
          />

          <button
            type="submit"
            disabled={!selectedDocId || !query.trim() || compareMutation.isPending}
            className="btn-primary flex items-center gap-2 shrink-0"
          >
            {compareMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Run
          </button>
        </div>

        {compareMutation.isError && (
          <p className="text-xs text-red-400">
            {compareMutation.error?.response?.data?.detail || 'Request failed'}
          </p>
        )}
      </form>

      {/* Router recommendation */}
      {result?.router && <RouterBadge router={result.router} />}

      {/* Side-by-side results */}
      {(result || compareMutation.isPending) && (
        <div className="flex gap-4">
          <AnswerPanel
            color="vector"
            result={result?.vector}
            isLoading={compareMutation.isPending}
          />
          <AnswerPanel
            color="vectorless"
            result={result?.vectorless}
            isLoading={compareMutation.isPending}
          />
        </div>
      )}

      {!result && !compareMutation.isPending && readyDocs.length === 0 && (
        <div className="card text-center py-12 text-slate-500 text-sm">
          No documents ready yet.{' '}
          <a href="/" className="text-accent-400 hover:underline">Upload a PDF</a> to get started.
        </div>
      )}
    </div>
  )
}
