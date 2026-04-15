# RAG-Arena — Cross-Session Memory

This file is the persistent context for Claude Code sessions on this project.
Update it at the end of every session so the next session (even on a different
account) can pick up seamlessly.

---

## Project Summary

RAG-Arena: side-by-side comparison of Vector RAG vs Vectorless RAG (hierarchical tree navigation).
Public GitHub repo. Portfolio piece for AI engineering job applications.
2-week build. All free-tier infrastructure. Zero spend.

---

## Stack

| Layer | Choice |
|-------|--------|
| Backend | Python 3.11 + FastAPI |
| Frontend | React 18 + Tailwind + Vite |
| DB | Supabase Postgres + pgvector (HNSW) |
| LLM — nav/routing | Groq llama-3.1-8b-instant |
| LLM — answers | Groq llama-3.3-70b-versatile |
| Embeddings | Gemini text-embedding-004 (768-dim) |
| PDF | PyMuPDF |
| Backend host | Fly.io (auto_stop_machines = false) |
| Frontend host | Vercel |
| PDF storage | Supabase Storage (NOT local disk) |

---

## Current State (last updated: 2026-04-15, Session 1)

### Completed
- [x] Full monorepo directory structure
- [x] `.gitignore`, `.env.example`, `README.md` skeleton
- [x] `backend/db/schema.sql` — full schema (5 tables, HNSW index, path index)
- [x] `backend/config.py` — Pydantic Settings, all env vars
- [x] `backend/main.py` — FastAPI app, CORS, lifespan, /health endpoint
- [x] `backend/api/` — all 4 routers (documents, queries, eval, metrics)
- [x] `backend/db/` — supabase_client.py (sync + asyncpg for cosine search), tree_store.py
- [x] `backend/llm/` — groq_client.py (async, retry), prompts.py (all templates)
- [x] `backend/ingestion/` — pdf_parser.py, chunker.py, embedder.py, hierarchy_extractor.py, tree_builder.py, node_summarizer.py
- [x] `backend/pipelines/` — vector_rag.py, vectorless_rag.py
- [x] `backend/router/classifier.py` — query type + doc type + decision matrix
- [x] `backend/Dockerfile`, `backend/fly.toml`
- [x] `DECISIONS.md` — 10 decisions with trade-offs
- [x] `NOTES.md` — session 1 log

### Not yet done
- [ ] Unit tests (`backend/tests/`)
- [ ] Frontend (React + Tailwind + Vite)
- [ ] Eval suite (`eval/`)
- [ ] Supabase project setup (user needs to do this manually — see Setup section)
- [ ] Fly.io deploy
- [ ] Vercel deploy

---

## Setup Required (one-time, by user)

### 1. Supabase
1. Create project at supabase.com (free)
2. Project Settings → Database → enable pgvector extension (or run `CREATE EXTENSION vector;`)
3. SQL Editor → paste and run `backend/db/schema.sql`
4. Storage → create bucket named `documents` (public read OFF)
5. Project Settings → API → copy `URL`, `anon key`, `service_role key`
6. Project Settings → Database → Connection Pooling → copy Transaction pooler URL (port 6543)

### 2. Groq
- Create account at console.groq.com, create an API key

### 3. Gemini
- Get key at aistudio.google.com → Get API Key

### 4. Environment
```
cp .env.example .env
# fill in all values
```

### 5. Fly.io (backend deploy)
```bash
cd backend
flyctl launch --config fly.toml  # first time only
flyctl secrets set SUPABASE_URL=... GROQ_API_KEY=... GEMINI_API_KEY=...  # etc.
flyctl deploy --config fly.toml
```

### 6. Vercel (frontend deploy)
- Import GitHub repo in Vercel dashboard
- Set root directory to `frontend`
- Add env var: `VITE_API_URL=https://rag-arena-backend.fly.dev`

---

## Key Design Decisions (summary — see DECISIONS.md for full rationale)

1. Always run BOTH pipelines in parallel (`asyncio.gather`) — comparison data on every query
2. LLM navigates the tree (not embeddings) — section titles too short for reliable embedding
3. HNSW index (not IVFFlat) — works from first row, no training data needed
4. Adjacency list + TEXT path for tree — trivial inserts, prefix queries with LIKE
5. Supabase Storage for PDFs — Fly.io disk is ephemeral
6. Internal node summaries cached at ingest — cheap navigation, never regenerated
7. Gemini embeddings (free, 768-dim) over OpenAI (costs money)
8. Groq for LLM (free tier) — 8B for nav/routing, 70B for final answers
9. Three-pass hierarchy extraction — handles TOC/font/regex PDFs
10. Fly.io over Render — no cold starts

---

## File Map (critical files to know)

```
backend/
  main.py                     FastAPI entry point
  config.py                   All settings via Pydantic + env vars
  api/documents.py            Upload + status + list + delete
  api/queries.py              /compare (both pipelines parallel) + single-pipeline endpoints
  db/supabase_client.py       Supabase client + asyncpg cosine_search()
  db/tree_store.py            insert/get children/subtree/leaf-texts
  ingestion/pdf_parser.py     PyMuPDF → ParsedDocument
  ingestion/chunker.py        Sliding window → Chunk list
  ingestion/embedder.py       Async Gemini batch embedding
  ingestion/hierarchy_extractor.py  3-pass hierarchy extraction + structure_score
  ingestion/tree_builder.py   RawSection list → TreeNode tree with paths
  ingestion/node_summarizer.py  Groq summaries for internal nodes (ingest time)
  pipelines/vector_rag.py     embed → cosine search → Groq answer
  pipelines/vectorless_rag.py LLM tree navigation → leaf retrieval → Groq answer
  router/classifier.py        query_type + doc_type + decision matrix → RouterOutput
  llm/groq_client.py          Async Groq wrapper, retry on 429
  llm/prompts.py              All prompt templates as constants
  db/schema.sql               Postgres schema source of truth
```

---

## Free Tier Limits to Watch

| Service | Limit | Current Usage | Warning Threshold |
|---------|-------|--------------|-------------------|
| Gemini embeddings | 1500 RPD | 0 | 1200/day |
| Gemini embeddings | 100 RPM | 0 | 80/min |
| Groq TPM (8B) | 6,000 TPM | 0 | 5,000 TPM |
| Groq TPM (70B) | 14,400 TPM | 0 | 12,000 TPM |
| Supabase storage | 500 MB | 0 | 400 MB |

---

## Conventions

- All prompt templates live in `llm/prompts.py` — never inline in pipeline code
- Groq nav model (`groq_nav_model`) for routing + navigation; answer model (`groq_answer_model`) for final answers only
- `asyncio.Semaphore(2)` on Gemini batch calls — never concurrent > 2
- `structure_score` is computed once in `hierarchy_extractor.py` and stored in `documents.structure_score` — never recomputed at query time
- DB upserts use unique constraints (document_id + chunk_index for chunks; document_id + path for tree) — safe to re-run ingestion
- `NOTES.md` — update every session with decisions, problems, learnings
- `CLAUDE.md` (this file) — update at end of every session
