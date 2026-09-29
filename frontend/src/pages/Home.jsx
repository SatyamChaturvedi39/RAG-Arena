import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, Trash2, ChevronRight, AlertCircle,
  Loader2, CheckCircle2, Zap, TreePine,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import { uploadDocument, listDocuments, deleteDocument, getDocumentStatus } from '../api/client'
import clsx from 'clsx'

// ─── Strategy cards ───────────────────────────────────────────────────────────

function StrategyCard({ type, delay = 0 }) {
  const isVector    = type === 'vector'
  const accent      = isVector ? 'rgba(99,102,241,' : 'rgba(20,184,166,'
  const textColor   = isVector ? '#818cf8' : '#2dd4bf'

  const cfg = isVector ? {
    label:       'Vector RAG',
    Icon:        Zap,
    tagline:     'Semantic similarity search',
    description: 'Converts your question into a high-dimensional vector and finds the closest matching document chunks using cosine similarity over a pgvector HNSW index.',
    bullets:     ['Sub-second lookup — no LLM at retrieval time', 'Best for keyword and semantic queries', 'Powered by Gemini embeddings (768-dim)'],
  } : {
    label:       'Vectorless RAG',
    Icon:        TreePine,
    tagline:     'LLM-guided tree navigation',
    description: 'Parses the document into a section hierarchy at ingest time. An LLM then navigates the tree branch-by-branch — no embeddings, just structured document reasoning.',
    bullets:     ['Follows document structure, not just similarity', 'Best for hierarchical or multi-step queries', 'Powered by Groq Llama 3.3 (70B)'],
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className="rounded-2xl border p-5 flex flex-col gap-3"
      style={{
        background:  `${accent}0.04)`,
        borderColor: `${accent}0.22)`,
        boxShadow:   `0 0 40px ${accent}0.06), inset 0 1px 0 ${accent}0.07)`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}0.12)`, border: `1px solid ${accent}0.22)` }}
        >
          <cfg.Icon className="w-4.5 h-4.5" style={{ color: textColor }} />
        </div>
        <div>
          <span className={isVector ? 'badge-vector' : 'badge-vectorless'}>{cfg.label}</span>
          <p className="text-xs text-slate-500 mt-0.5">{cfg.tagline}</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">{cfg.description}</p>

      <ul className="space-y-1.5">
        {cfg.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
            <span
              className="shrink-0 rounded-full"
              style={{ width: 4, height: 4, background: textColor, marginTop: '0.38rem' }}
            />
            {b}
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

// ─── Upload zone ──────────────────────────────────────────────────────────────

const getSessionId = () => {
  let sid = sessionStorage.getItem('rag_arena_session_id')
  if (!sid) {
    sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    sessionStorage.setItem('rag_arena_session_id', sid)
  }
  return sid
}

function UploadZone({ onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [error,     setError]     = useState(null)

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    setError(null)
    setSuccess(false)
    setUploading(true)
    try {
      const sessionId = getSessionId()
      const res = await uploadDocument(file, null, sessionId)
      onUploaded(res.data.document_id)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(e.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [onUploaded])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploading,
  })

  return (
    <div
      {...getRootProps()}
      className={clsx(
        'relative rounded-2xl p-10 text-center cursor-pointer transition-all duration-300',
        'border-2 border-dashed',
        isDragActive  ? 'border-accent-400' : 'border-surface-600 hover:border-surface-500',
        uploading && 'pointer-events-none opacity-60',
      )}
      style={isDragActive ? {
        background: 'rgba(99,102,241,0.08)',
        boxShadow: '0 0 50px rgba(99,102,241,0.18), inset 0 0 40px rgba(99,102,241,0.08)',
      } : {
        background: 'rgba(15,23,42,0.6)',
      }}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <motion.div
          animate={isDragActive ? { scale: 1.1, rotate: -5 } : { scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: isDragActive ? 'rgba(99,102,241,0.25)' : 'rgba(30,41,59,0.8)',
            border: `1px solid ${isDragActive ? 'rgba(99,102,241,0.5)' : 'rgba(51,65,85,0.8)'}`,
          }}
        >
          {uploading  ? <Loader2    className="w-5 h-5 text-indigo-400 animate-spin" />
           : success  ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
           : <Upload className={clsx('w-5 h-5 transition-colors', isDragActive ? 'text-indigo-300' : 'text-indigo-400')} />
          }
        </motion.div>

        <div>
          <p className="text-slate-100 text-sm font-semibold">
            {uploading    ? 'Uploading document…'
             : success    ? 'Uploaded — processing started'
             : isDragActive ? 'Drop to upload'
             : 'Drag & drop a PDF, or click to browse'}
          </p>
          <p className="text-slate-400 text-xs mt-1">Research papers · 10-K filings · legal contracts · technical manuals</p>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center justify-center gap-1.5 text-red-400 text-xs"
          >
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Document row ─────────────────────────────────────────────────────────────

function StatusBadge({ status, pct }) {
  const styles = {
    ready:         { bg: 'rgba(52,211,153,0.15)', color: '#34d399', border: 'rgba(52,211,153,0.30)' },
    failed:        { bg: 'rgba(248,113,113,0.15)', color: '#f87171', border: 'rgba(248,113,113,0.30)' },
    pending:       { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.30)' },
    parsing:       { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.30)' },
    embedding:     { bg: 'rgba(129,140,248,0.15)', color: '#818cf8', border: 'rgba(129,140,248,0.30)' },
    tree_building: { bg: 'rgba(192,132,252,0.15)', color: '#c084fc', border: 'rgba(192,132,252,0.30)' },
  }
  const s = styles[status] || { bg: 'rgba(30,41,59,0.6)', color: '#94a3b8', border: 'rgba(51,65,85,1)' }
  return (
    <span
      className="text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {status === 'ready' ? 'ready' : `${status}${pct < 100 ? ` ${pct}%` : ''}`}
    </span>
  )
}

function DocumentRow({ doc, onDelete, onSelect }) {
  const isTerminal = doc.status === 'ready' || doc.status === 'failed'
  const { data: liveDoc } = useQuery({
    queryKey: ['doc-status', doc.id],
    queryFn: () => getDocumentStatus(doc.id).then((r) => r.data),
    refetchInterval: isTerminal ? false : 2000,
    initialData: doc,
  })
  const d = liveDoc || doc
  const isIngesting = !isTerminal

  return (
    <motion.div
      layout
      className="doc-card rounded-xl border p-4 flex items-center gap-4 transition-all duration-200 group bg-slate-900/80 backdrop-blur-md shadow-md"
      style={{
        borderColor: isIngesting ? 'rgba(99,102,241,0.4)' : '#1e293b',
      }}
      whileHover={{ borderColor: 'rgba(99,102,241,0.5)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-slate-800/80 border border-slate-700/80"
      >
        <FileText className="w-4 h-4 text-indigo-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-100 truncate">{d.filename}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {[
            d.page_count      && `${d.page_count} pages`,
            d.doc_type,
            d.structure_score != null && `structure ${(d.structure_score * 100).toFixed(0)}%`,
            d.total_chunks    && `${d.total_chunks} chunks`,
          ].filter(Boolean).join(' · ')}
        </p>
        {isIngesting && d.progress_pct > 0 && (
          <div className="progress-bar mt-2 w-full">
            <div className="progress-fill" style={{ width: `${d.progress_pct}%` }} />
          </div>
        )}
      </div>

      <StatusBadge status={d.status} pct={d.progress_pct || 0} />

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onSelect(d.id)}
          disabled={d.status !== 'ready'}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-30"
        >
          Compare <ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={() => onDelete(d.id)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Home page ────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const listRef     = useRef(null)

  const [deleteError, setDeleteError] = useState(null)

  // Client-side isolation: only show documents uploaded by this user in this browser
  const [myDocIds, setMyDocIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rag_arena_my_docs') || '[]')
    } catch {
      return []
    }
  })

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => listDocuments({ session_id: getSessionId() }).then((r) => r.data),
    refetchInterval: 5000,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: (data, deletedId) => {
      // Remove from localStorage
      const updatedIds = myDocIds.filter(id => id !== deletedId)
      setMyDocIds(updatedIds)
      localStorage.setItem('rag_arena_my_docs', JSON.stringify(updatedIds))
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => {
      setDeleteError(err.response?.data?.detail || "Failed to delete document. Please check your network connection.")
      setTimeout(() => setDeleteError(null), 4000)
    }
  })

  // Filter docs to only show ones this user uploaded
  const allDocs = data?.items || []
  const docs = allDocs.filter(doc => myDocIds.includes(doc.id))

  useEffect(() => {
    if (!docs.length || !listRef.current) return
    gsap.from(listRef.current.querySelectorAll('.doc-card'), {
      opacity: 0, y: 14, stagger: 0.07, duration: 0.4, ease: 'power2.out', clearProps: 'all',
    })
  }, [docs.length])

  const handleUploaded = (docId) => {
    // Add to localStorage
    const updatedIds = [...myDocIds, docId]
    setMyDocIds(updatedIds)
    localStorage.setItem('rag_arena_my_docs', JSON.stringify(updatedIds))
    queryClient.invalidateQueries({ queryKey: ['documents'] })
  }

  return (
    <div className="space-y-10">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center space-y-3 pt-4"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 mb-2">
          <span>⚔️</span>
          <span>Deterministic Dual-Axis Benchmarking Arena</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          Benchmarking Vector vs. Vectorless Retrieval
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          An empirical research platform for evaluating RAG paradigms. Upload any document to test how the Deterministic Dual-Axis Router (DDAR) evaluates query surprisal and entity density.
        </p>
      </motion.section>

      {/* ── DDAR Pipeline Flow ────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto card p-6 bg-slate-900/75 border border-slate-800 shadow-2xl backdrop-blur-md rounded-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1 text-center p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 w-full md:w-auto">
            <h4 className="font-semibold text-sm text-sky-400">1. Query Analysis</h4>
            <p className="text-xs text-slate-400 mt-1 font-mono">S(q) Surprisal</p>
            <p className="text-xs text-slate-400 font-mono">D(q) Density & SQT</p>
          </div>
          
          <div className="text-slate-600 font-bold hidden md:block">→</div>
          
          <div className="flex-1 text-center p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 w-full md:w-auto">
            <h4 className="font-semibold text-sm text-amber-400">2. DDAR Routes</h4>
            <p className="text-xs text-slate-400 mt-1">Parametric /</p>
            <p className="text-xs text-slate-400">Vector / Vectorless</p>
          </div>
          
          <div className="text-slate-600 font-bold hidden md:block">→</div>
          
          <div className="flex-1 text-center p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 w-full md:w-auto">
            <h4 className="font-semibold text-sm text-indigo-400">3. Pipelines Run</h4>
            <p className="text-xs text-slate-400 mt-1">Vector + Vectorless</p>
            <p className="text-xs text-slate-400">Parallel execution</p>
          </div>
          
          <div className="text-slate-600 font-bold hidden md:block">→</div>
          
          <div className="flex-1 text-center p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 w-full md:w-auto">
            <h4 className="font-semibold text-sm text-emerald-400">4. Human Vote</h4>
            <p className="text-xs text-slate-400 mt-1">Crowdsource</p>
            <p className="text-xs text-slate-400">Preference logging</p>
          </div>
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto">
        <div
          className="flex items-center gap-3 text-xs text-slate-400 uppercase tracking-widest font-semibold"
        >
          <div className="flex-1 h-px bg-slate-800" />
          Upload a document to start
          <div className="flex-1 h-px bg-slate-800" />
        </div>
      </div>

      {/* ── Upload + document list ────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto space-y-4">
        <UploadZone onUploaded={handleUploaded} />

        <AnimatePresence>
          {deleteError && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-1.5 text-red-400 text-xs mt-2"
            >
              <AlertCircle className="w-3.5 h-3.5" /> {deleteError}
            </motion.p>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 rounded-2xl border border-dashed border-slate-800 bg-slate-900/40"
          >
            <p className="text-slate-300 text-sm font-medium">No documents uploaded yet.</p>
            <p className="text-slate-400 text-xs mt-1">
              Upload a document above to run side-by-side evaluations. Uploads are private to this browser session.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2" ref={listRef}>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-medium px-1">
              Your uploaded documents
            </p>
            <AnimatePresence>
              {docs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onSelect={(id) => navigate(`/compare?doc=${id}`)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  )
}
