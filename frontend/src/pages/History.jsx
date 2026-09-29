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
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
  Clock,
  Compass,
  FileText,
  Trash2,
  Sparkles,
  Zap,
  TreePine
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3 text-white tracking-tight">
          <Layers className="w-7 h-7 text-indigo-400" />
          Query History
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Review, analyze, and instantly replay past arena comparisons across your documents.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 flex flex-col md:flex-row gap-4 items-center bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search query text..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="input w-full pl-10"
          />
        </div>

        {/* Document Selector */}
        <div className="relative w-full md:w-64">
          <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="input w-full pl-10 appearance-none cursor-pointer"
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
          className="btn-secondary p-2.5 flex shrink-0 items-center justify-center w-full md:w-auto"
          title="Reload History"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Query List */}
      <div className="space-y-4">
        {loading && queries.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        ) : filteredQueries.length > 0 ? (
          filteredQueries.map((q) => {
            const isExpanded = expandedQueryId === q.id
            const vectorRes = q.pipeline_results?.find(r => r.pipeline === 'vector')
            const vectorlessRes = q.pipeline_results?.find(r => r.pipeline === 'vectorless')
            const route = q.dual_axis_result?.route || q.router_recommended

            return (
              <div
                key={q.id}
                className="overflow-hidden border border-slate-800 hover:border-slate-700 bg-slate-900/80 shadow-lg backdrop-blur-md rounded-2xl transition-all duration-200"
              >
                {/* Header Summary (Clickable) */}
                <div
                  onClick={() => toggleExpand(q.id)}
                  className="p-5 flex items-start justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="space-y-2 md:flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <Calendar className="w-3 h-3" /> {formatDate(q.created_at)}
                      </span>
                      <span 
                        className="flex items-center gap-1 text-[11px] text-slate-300 font-semibold bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700 max-w-[220px] truncate"
                        title={q.document_filename || getDocName(q.document_id)}
                      >
                        <FileText className="w-3 h-3 text-sky-400" /> {q.document_filename || getDocName(q.document_id)}
                      </span>
                      {route && (
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                            route === 'parametric'
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                              : route === 'vector'
                              ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                          }`}
                        >
                          {route === 'parametric'
                            ? '⚡ Parametric'
                            : route === 'vector'
                            ? '🎯 Vector RAG'
                            : '🌲 Vectorless RAG'}
                        </span>
                      )}
                      {q.dual_axis_result?.s_q != null && (
                        <span className="text-[10px] font-mono text-slate-400 self-center">
                          S(q)={q.dual_axis_result.s_q.toFixed(1)} bits
                        </span>
                      )}
                    </div>
                    <p className="text-white font-medium text-base pr-4">
                      {q.query_text}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReRun(q.document_id, q.query_text)
                      }}
                      className="py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 rounded-xl border border-indigo-500/30 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
                      title="Run comparison again"
                    >
                      Compare <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(q.id, e)}
                      className="p-2 text-xs flex items-center justify-center border border-slate-800 hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors rounded-xl text-slate-400 bg-slate-900"
                      title="Delete query entry"
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
                      className="border-t border-slate-800 bg-slate-950/70 overflow-hidden"
                    >
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Vector RAG answer panel */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                            <span className="badge-vector flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-indigo-400" /> Vector RAG
                            </span>
                            {vectorRes && (
                              <div className="flex gap-3 text-[11px] text-slate-400 font-mono">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-sky-400" /> {vectorRes.latency_ms}ms
                                </span>
                                <span className="flex items-center gap-1">
                                  <Compass className="w-3 h-3 text-indigo-400" /> {(vectorRes.llm_prompt_tokens || 0) + (vectorRes.llm_completion_tokens || 0)} tok
                                </span>
                              </div>
                            )}
                          </div>
                          {vectorRes ? (
                            <div className="space-y-2">
                              <div className="text-slate-100 text-sm leading-relaxed whitespace-pre-line bg-slate-900/90 p-4 rounded-xl border border-slate-800 font-sans">
                                {vectorRes.answer}
                              </div>
                              {vectorRes.top_similarity_score !== null && (
                                <div className="text-[11px] text-slate-400 font-mono flex gap-1">
                                  <span>Top similarity:</span>
                                  <span className="text-indigo-400 font-semibold">{vectorRes.top_similarity_score?.toFixed(4) || 'N/A'}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">No Vector pipeline results recorded.</p>
                          )}
                        </div>

                        {/* Vectorless RAG answer panel */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                            <span className="badge-vectorless flex items-center gap-1.5">
                              <TreePine className="w-3 h-3 text-emerald-400" /> Vectorless RAG
                            </span>
                            {vectorlessRes && (
                              <div className="flex gap-3 text-[11px] text-slate-400 font-mono">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-sky-400" /> {vectorlessRes.latency_ms}ms
                                </span>
                                <span className="flex items-center gap-1">
                                  <Compass className="w-3 h-3 text-emerald-400" /> {(vectorlessRes.llm_prompt_tokens || 0) + (vectorlessRes.llm_completion_tokens || 0)} tok
                                </span>
                              </div>
                            )}
                          </div>
                          {vectorlessRes ? (
                            <div className="space-y-2">
                              <div className="text-slate-100 text-sm leading-relaxed whitespace-pre-line bg-slate-900/90 p-4 rounded-xl border border-slate-800 font-sans">
                                {vectorlessRes.answer}
                              </div>
                              {vectorlessRes.navigation_path && (
                                <div className="text-[11px] text-slate-400 font-mono flex flex-col gap-1 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                                  <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[9px]">Navigation Breadcrumb</span>
                                  <span className="text-slate-200">{vectorlessRes.navigation_path}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">No Vectorless pipeline results recorded.</p>
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
          <div className="p-12 text-center text-slate-400 space-y-3 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl">
            <Layers className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">No past queries match your filter.</p>
            <button onClick={() => navigate('/compare')} className="btn-primary text-xs mx-auto">
              Run New Comparison
            </button>
          </div>
        )}
      </div>

      {/* Pagination Load More */}
      {queries.length < total && (
        <div className="text-center pt-2">
          <button
            onClick={loadMore}
            className="btn-secondary text-xs px-6 py-2.5"
          >
            Load Older Queries ({total - queries.length} remaining)
          </button>
        </div>
      )}
    </div>
  )
}
