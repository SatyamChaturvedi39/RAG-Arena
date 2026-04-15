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
        'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
        isDragActive
          ? 'border-accent-400 bg-accent-500/10'
          : 'border-surface-600 hover:border-surface-500 hover:bg-surface-700/30',
        uploading && 'pointer-events-none opacity-60',
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {uploading ? (
          <Loader2 className="w-8 h-8 text-accent-400 animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-slate-500" />
        )}
        <p className="text-slate-400 text-sm">
          {uploading
            ? 'Uploading…'
            : isDragActive
            ? 'Drop the PDF here'
            : 'Drag & drop a PDF, or click to browse'}
        </p>
        <p className="text-slate-600 text-xs">Supports 10-Ks, legal contracts, technical docs</p>
      </div>
      {error && (
        <p className="mt-3 flex items-center justify-center gap-1 text-red-400 text-xs">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  )
}

// ─── Document row with live status polling ────────────────────────────────────

function DocStatusBadge({ status, pct }) {
  const colors = {
    ready: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    parsing: 'bg-blue-500/20 text-blue-400',
    embedding: 'bg-indigo-500/20 text-indigo-400',
    tree_building: 'bg-purple-500/20 text-purple-400',
  }
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', colors[status] || 'bg-slate-700 text-slate-400')}>
      {status === 'ready' ? 'ready' : `${status} ${pct < 100 ? `${pct}%` : ''}`}
    </span>
  )
}

function DocumentRow({ doc, onDelete, onSelect }) {
  // Poll status while not terminal
  const isTerminal = doc.status === 'ready' || doc.status === 'failed'
  const { data: liveDoc } = useQuery({
    queryKey: ['doc-status', doc.id],
    queryFn: () => getDocumentStatus(doc.id).then((r) => r.data),
    refetchInterval: isTerminal ? false : 2000,
    initialData: doc,
  })

  const d = liveDoc || doc

  return (
    <div className="card flex items-center gap-4 hover:border-surface-500 transition-colors">
      <FileText className="w-5 h-5 text-slate-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{d.filename}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {d.page_count ? `${d.page_count} pages` : ''}
          {d.doc_type ? ` · ${d.doc_type}` : ''}
          {d.structure_score != null ? ` · structure ${(d.structure_score * 100).toFixed(0)}%` : ''}
          {d.total_chunks ? ` · ${d.total_chunks} chunks` : ''}
        </p>
      </div>
      <DocStatusBadge status={d.status} pct={d.progress_pct || 0} />
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onSelect(d.id)}
          disabled={d.status !== 'ready'}
          className="btn-secondary text-xs py-1 px-3 flex items-center gap-1 disabled:opacity-40"
        >
          Compare <ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={() => onDelete(d.id)}
          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-md hover:bg-red-400/10"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Home page ────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pendingIds, setPendingIds] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => listDocuments().then((r) => r.data),
    refetchInterval: 5000,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })

  const handleUploaded = (docId) => {
    setPendingIds((ids) => [...ids, docId])
    queryClient.invalidateQueries({ queryKey: ['documents'] })
  }

  const docs = data?.items || []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Documents</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload PDFs to index them with both RAG pipelines. Financial filings, legal
          contracts, and technical manuals work best.
        </p>
      </div>

      <UploadZone onUploaded={handleUploaded} />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-center text-slate-600 text-sm py-8">
          No documents yet. Upload a PDF above to get started.
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
