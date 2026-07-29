import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getQueryHistory,
  listDocuments,
  deleteQuery
} from '../api/client'
import {
  Search,
  Filter,
  Calendar,
  Layers,
  Cpu,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
  TrendingDown,
  Clock,
  Compass,
  FileText,
  Trash2
} from 'lucide-react'

const getSessionId = () => {
  let sid = sessionStorage.getItem('rag_arena_session_id')
  if (!sid) {
    sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    sessionStorage.setItem('rag_arena_session_id', sid)
  }
  return sid
}

export default function History() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [queries, setQueries] = useState([])
  const [documents, setDocuments] = useState([])
  const [selectedDocId, setSelectedDocId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedQueryId, setExpandedQueryId] = useState(null)
  
  // Pagination
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 20

  const loadData = async (reset = false) => {
    setLoading(true)
    try {
      const currentOffset = reset ? 0 : offset
      if (reset) setOffset(0)

      const sessionId = getSessionId()
      const [historyRes, docsRes] = await Promise.all([
        getQueryHistory(selectedDocId || null, limit, currentOffset, sessionId),
        listDocuments({ session_id: sessionId })
      ])

      setDocuments(docsRes.data.items || [])
      setTotal(historyRes.data.total || 0)
      
      if (reset) {
        setQueries(historyRes.data.items || [])
      } else {
        setQueries(prev => [...prev, ...(historyRes.data.items || [])])
      }
    } catch (err) {
      console.error('Error fetching query history:', err)
    } finally {
      setLoading(false)
    }
  }

  // Reload history when selected document changes
  useEffect(() => {
    loadData(true)
  }, [selectedDocId])

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
  }

  const loadMore = () => {
    const nextOffset = offset + limit
    setOffset(nextOffset)
    const sessionId = getSessionId()
    // Trigger history load for next page
    getQueryHistory(selectedDocId || null, limit, nextOffset, sessionId).then(res => {
      setQueries(prev => [...prev, ...(res.data.items || [])])
      setTotal(res.data.total || 0)
    }).catch(err => console.error(err))
  }

  const handleDelete = async (queryId, e) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this query from your history?')) {
      return
    }
    try {
      await deleteQuery(queryId)
      setQueries(prev => prev.filter(q => q.id !== queryId))
      setTotal(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error deleting query:', err)
      alert('Failed to delete query. Please try again.')
    }
  }

  const toggleExpand = (id) => {
    setExpandedQueryId(expandedQueryId === id ? null : id)
  }

  const handleReRun = (docId, queryText) => {
    navigate('/compare', { state: { documentId: docId, query: queryText } })
  }

  // Filter history by search query
  const filteredQueries = queries.filter(q =>
    q.query_text.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getDocName = (docId) => {
    const doc = documents.find(d => d.id === docId)
    return doc ? doc.filename : 'Unknown Document'
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto text-[var(--color-text)]">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2 text-[var(--color-primary)]">
          <Layers className="w-8 h-8 text-[var(--color-accent)]" />
          Query History
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Browse, replay, and compare past queries executed across uploaded documents.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 flex flex-col md:flex-row gap-4 items-center bg-white border border-[var(--color-border)] rounded-xl">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search queries..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="input w-full pl-9"
          />
        </div>

        {/* Document Selector */}
        <div className="relative w-full md:w-64">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="input w-full pl-9 appearance-none cursor-pointer"
          >
            <option value="">All Documents</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filename.length > 25 ? `${doc.filename.slice(0, 25)}...` : doc.filename}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Reload */}
        <button
          onClick={() => loadData(true)}
          className="btn-secondary p-2 flex shrink-0 items-center justify-center w-full md:w-auto"
          title="Reload History"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Query List */}
      <div className="space-y-4">
        {filteredQueries.length > 0 ? (
          filteredQueries.map((q) => {
            const isExpanded = expandedQueryId === q.id
            const vectorRes = q.pipeline_results?.find(r => r.pipeline === 'vector')
            const vectorlessRes = q.pipeline_results?.find(r => r.pipeline === 'vectorless')

            return (
              <div
                key={q.id}
                className="card p-0 overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] bg-white transition-all duration-200"
              >
                {/* Header Summary (Clickable) */}
                <div
                  onClick={() => toggleExpand(q.id)}
                  className="p-5 flex items-start justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="space-y-1.5 md:flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted)] font-mono">
                        <Calendar className="w-3 h-3" /> {formatDate(q.created_at)}
                      </span>
                      <span 
                        className="flex items-center gap-1 text-[10px] text-[var(--color-accent)] font-semibold bg-slate-50 px-2 py-0.5 rounded-full border border-[var(--color-border)] max-w-[200px] truncate"
                        title={q.document_filename || getDocName(q.document_id)}
                      >
                        <FileText className="w-3 h-3" /> {q.document_filename || getDocName(q.document_id)}
                      </span>
                      {q.query_type && (
                        <span className="text-[10px] font-mono text-[var(--color-muted)] bg-slate-50 border border-[var(--color-border)] px-1.5 py-0.5 rounded">
                          {q.query_type.replace('_', ' ')}
                        </span>
                      )}
                      {q.dual_axis_result && q.dual_axis_result.route ? (
                        <>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              q.dual_axis_result.route === 'parametric'
                                ? "bg-amber-500/10 border-amber-500/30 text-[#E6A817]"
                                : q.dual_axis_result.route === 'vector'
                                ? "bg-indigo-500/10 border-indigo-500/30 text-[#1A6B8A]"
                                : "bg-teal-500/10 border-teal-500/30 text-[#2D6A4F]"
                            }`}
                          >
                            {q.dual_axis_result.route === 'parametric'
                              ? 'Parametric'
                              : q.dual_axis_result.route === 'vector'
                              ? 'Vector'
                              : 'Vectorless'}
                          </span>
                          {q.dual_axis_result.s_q != null && (
                            <span className="text-[10px] font-mono text-[var(--color-muted)] self-center ml-0.5">
                              S={q.dual_axis_result.s_q.toFixed(1)}
                              {q.dual_axis_result.d_q != null ? ` D=${q.dual_axis_result.d_q.toFixed(2)}` : ''}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-zinc-500/10 border-zinc-500/30 text-zinc-400">
                          Pre-DDAR
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--color-text)] font-semibold text-sm md:text-base pr-4">
                      {q.query_text}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReRun(q.document_id, q.query_text)
                      }}
                      className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 bg-indigo-500/5"
                      title="Run comparison again"
                    >
                      Compare <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(q.id, e)}
                      className="btn-secondary p-1.5 text-xs flex items-center justify-center border-red-200 hover:border-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 rounded-lg text-slate-500 bg-white"
                      title="Delete query history entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {/* Collapsible Panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="border-t border-slate-200 bg-slate-50/50 overflow-hidden"
                    >
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Vector RAG answer panel */}
                        <div className="space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <span className="badge-vector">Vector RAG</span>
                            <div className="flex gap-2">
                              {vectorRes && (
                                <>
                                  <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                    <Clock className="w-3 h-3" /> {vectorRes.latency_ms}ms
                                  </span>
                                  <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                    <Compass className="w-3 h-3" /> {vectorRes.llm_prompt_tokens + vectorRes.llm_completion_tokens} tokens
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {vectorRes ? (
                            <div className="space-y-2">
                              <p className="text-[var(--color-text)] text-sm leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-slate-200 font-sans">
                                {vectorRes.answer}
                              </p>
                              {vectorRes.top_similarity_score !== null && (
                                <div className="text-[10px] text-slate-500 font-mono flex gap-1">
                                  <span>Top similarity:</span>
                                  <span className="text-amber-600 font-semibold">{vectorRes.top_similarity_score?.toFixed(4) || 'N/A'}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No Vector pipeline results recorded for this run.</p>
                          )}
                        </div>

                        {/* Vectorless RAG answer panel */}
                        <div className="space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <span className="badge-vectorless">Vectorless RAG</span>
                            <div className="flex gap-2">
                              {vectorlessRes && (
                                <>
                                  <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                    <Clock className="w-3 h-3" /> {vectorlessRes.latency_ms}ms
                                  </span>
                                  <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                    <Compass className="w-3 h-3" /> {vectorlessRes.llm_prompt_tokens + vectorlessRes.llm_completion_tokens} tokens
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {vectorlessRes ? (
                            <div className="space-y-2">
                              <p className="text-[var(--color-text)] text-sm leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-slate-200 font-sans">
                                {vectorlessRes.answer}
                              </p>
                              {vectorlessRes.navigation_path && (
                                <div className="text-[10px] text-slate-500 font-mono flex flex-col gap-1 p-2 rounded bg-slate-100/50 border border-slate-200">
                                  <span className="text-emerald-700 font-semibold uppercase tracking-wider text-[8px]">Navigation Path</span>
                                  <span>{vectorlessRes.navigation_path}</span>
                                </div>
                              )}
                              {vectorlessRes.fallback_used && (
                                <span className="inline-block text-[9px] font-bold text-amber-600 uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  Fallback to Vector Used
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No Vectorless pipeline results recorded for this run.</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        ) : (
          <div className="card p-12 text-center text-slate-400 space-y-4 bg-white border border-[var(--color-border)] rounded-xl">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm">No past comparison queries match your current filter.</p>
            <button onClick={() => navigate('/compare')} className="btn-primary text-xs">
              Run New Comparison
            </button>
          </div>
        )}
      </div>

      {/* Load More Button */}
      {total > queries.length && (
        <div className="flex justify-center pt-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="btn-secondary text-xs flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Load More Queries'}
          </button>
        </div>
      )}
    </div>
  )
}
