import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Trash2, ChevronRight, AlertCircle, Loader2 } from 'lucide-react'
import { uploadDocument, listDocuments, deleteDocument, getDocumentStatus } from '../api/client'
import clsx from 'clsx'

// ─── Upload zone ──────────────────────────────────────────────────────────────

function UploadZone({ onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const res = await uploadDocument(file)
      onUploaded(res.data.document_id)
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
        isDragActive
          ? 'border-accent-400 bg-accent-500/8'
          : 'border-surface-600 hover:border-surface-500',
        uploading && 'pointer-events-none opacity-60',
      )}
      style={isDragActive ? {
        background: 'rgba(99, 102, 241, 0.06)',
        boxShadow: '0 0 40px rgba(99, 102, 241, 0.12), inset 0 0 40px rgba(99, 102, 241, 0.04)',
      } : {
        background: 'rgba(15, 22, 35, 0.4)',
      }}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <div
          className={clsx(
            'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300',
          )}
          style={{
            background: isDragActive
              ? 'rgba(99, 102, 241, 0.2)'
              : 'rgba(30, 45, 66, 0.8)',
            border: `1px solid ${isDragActive ? 'rgba(99, 102, 241, 0.4)' : 'rgba(30, 45, 66, 1)'}`,
          }}
        >
          {uploading
            ? <Loader2 className="w-5 h-5 text-accent-400 animate-spin" />
            : <Upload className={clsx('w-5 h-5 transition-colors', isDragActive ? 'text-accent-300' : 'text-slate-500')} />
          }
        </div>

        <div>
          <p className="text-slate-300 text-sm font-medium">
            {uploading
              ? 'Uploading…'
              : isDragActive
              ? 'Drop it here'
              : 'Drag & drop a PDF, or click to browse'}
          </p>
          <p className="text-slate-600 text-xs mt-1">
            10-Ks · legal contracts · technical manuals
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
    </div>
  )
}

// ─── Document row ─────────────────────────────────────────────────────────────

function StatusBadge({ status, pct }) {
  const styles = {
    ready:        { bg: 'rgba(74, 222, 128, 0.10)', color: '#4ade80', border: 'rgba(74, 222, 128, 0.20)' },
    failed:       { bg: 'rgba(248, 113, 113, 0.10)', color: '#f87171', border: 'rgba(248, 113, 113, 0.20)' },
    pending:      { bg: 'rgba(251, 191, 36, 0.10)',  color: '#fbbf24', border: 'rgba(251, 191, 36, 0.20)' },
    parsing:      { bg: 'rgba(96, 165, 250, 0.10)',  color: '#60a5fa', border: 'rgba(96, 165, 250, 0.20)' },
    embedding:    { bg: 'rgba(99, 102, 241, 0.10)',  color: '#818cf8', border: 'rgba(99, 102, 241, 0.20)' },
    tree_building:{ bg: 'rgba(167, 139, 250, 0.10)', color: '#a78bfa', border: 'rgba(167, 139, 250, 0.20)' },
  }
  const s = styles[status] || { bg: 'rgba(30,45,66,0.6)', color: '#64748b', border: 'rgba(30,45,66,1)' }

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
    <div
      className="rounded-xl border p-4 flex items-center gap-4 transition-all duration-200 group"
      style={{
        background: 'rgba(15, 22, 35, 0.6)',
        borderColor: isIngesting ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 45, 66, 0.7)',
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(30, 45, 66, 0.8)', border: '1px solid rgba(42, 61, 88, 0.8)' }}
      >
        <FileText className="w-4 h-4 text-slate-500" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{d.filename}</p>
        <p className="text-xs text-slate-600 mt-0.5">
          {[
            d.page_count && `${d.page_count} pages`,
            d.doc_type,
            d.structure_score != null && `structure ${(d.structure_score * 100).toFixed(0)}%`,
            d.total_chunks && `${d.total_chunks} chunks`,
          ].filter(Boolean).join(' · ')}
        </p>

        {/* Progress bar for in-progress docs */}
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
          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248, 113, 113, 0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Home page ────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => listDocuments().then((r) => r.data),
    refetchInterval: 5000,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })

  const handleUploaded = () => {
    queryClient.invalidateQueries({ queryKey: ['documents'] })
  }

  const docs = data?.items || []

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Documents</h1>
        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
          Upload a PDF to index it with both RAG pipelines simultaneously.
          Financial filings, legal contracts, and technical manuals work best.
        </p>
      </div>

      <UploadZone onUploaded={handleUploaded} />

      {/* Document list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-center text-slate-600 text-sm py-12">
          No documents yet — upload a PDF above to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onDelete={(id) => deleteMutation.mutate(id)}
              onSelect={(id) => navigate(`/compare?doc=${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
