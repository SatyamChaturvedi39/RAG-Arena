import axios from 'axios'

// In production (Vercel), VITE_API_URL is set to the Fly.io backend URL.
// In development, the Vite proxy rewrites /api/* → http://localhost:8000/*
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,   // 2 minutes — vectorless RAG with tree navigation can be slow
})

// ─── Documents ───────────────────────────────────────────────────────────────

export const uploadDocument = (file, docTypeHint) => {
  const form = new FormData()
  form.append('file', file)
  if (docTypeHint) form.append('doc_type_hint', docTypeHint)
  return api.post('/documents/upload', form)
}

export const getDocumentStatus = (docId) =>
  api.get(`/documents/${docId}/status`)

export const listDocuments = (params = {}) =>
  api.get('/documents', { params })

export const deleteDocument = (docId) =>
  api.delete(`/documents/${docId}`)

// ─── Queries ─────────────────────────────────────────────────────────────────

export const compareQuery = (documentId, query, overridePipeline, sessionId) =>
  api.post('/query/compare', {
    document_id: documentId,
    query,
    override_pipeline: overridePipeline || null,
    session_id: sessionId || null,
  })

export const vectorQuery = (documentId, query) =>
  api.post('/query/vector', { document_id: documentId, query })

export const vectorlessQuery = (documentId, query) =>
  api.post('/query/vectorless', { document_id: documentId, query })

// ─── Evaluation ──────────────────────────────────────────────────────────────

export const startEvalRun = (dataset, maxQuestions, sessionTag) =>
  api.post('/eval/run', { dataset, max_questions: maxQuestions, session_tag: sessionTag })

export const listEvalRuns = () =>
  api.get('/eval/runs')

export const getEvalRun = (runId) =>
  api.get(`/eval/runs/${runId}`)

// ─── Metrics ─────────────────────────────────────────────────────────────────

export const getMetricsSummary = (days = 7) =>
  api.get('/metrics/summary', { params: { days } })

export const getMetricsHistory = (limit = 100, pipeline) =>
  api.get('/metrics/history', { params: { limit, pipeline } })

// ─── Health ──────────────────────────────────────────────────────────────────

export const checkHealth = () =>
  api.get('/health')
