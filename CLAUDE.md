# RAG-Arena — Cross-Session Memory

This file is the persistent context for Claude Code sessions on this project.
Update it at the end of every session so the next session (even on a different
account) can pick up seamlessly.

## Session Rules (non-negotiable, follow every session)

1. **Commit frequently** — commit after every meaningful unit of work (a working module, a passing test, a completed feature). Never let more than ~1 hour of work sit uncommitted.
2. **No "Co-authored-by: Claude"** — never add this line to commit messages. Commits are authored by the user (SatyamChaturvedi39) only.
3. **Never stage or commit `INTERNALS.md`** — this is a private reference document and must never be pushed to GitHub. It is in `.gitignore`. If it ever appears in `git status` as untracked or modified, do not add it.
3. **Never include CLAUDE.md or NOTES.md in commits** — these are living session docs, not source code. Do not stage them with `git add`. They live in the repo from the initial commit but should not pollute the commit history with session-log noise.
4. **Update this file (CLAUDE.md) at the end of every session** — reflect current build state, what was completed, what's next. This is the continuity document.
5. **Update NOTES.md every session** — log decisions made, problems hit, things learned. This feeds the blog post.

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
| Embeddings | Gemini gemini-embedding-001 (768-dim, v1beta REST) |
| PDF | PyMuPDF |
| Backend host | Render (free tier, no card required) |
| Frontend host | Vercel |
| PDF storage | Supabase Storage |

### Why Render not Fly.io
Fly.io now requires a credit card even for free tier. Switched to Render (free, no card).
Cold starts mitigated by UptimeRobot pinging /health every 5 minutes.

### Why gemini-embedding-001 not text-embedding-004
text-embedding-004 is NOT available under this project's API key quota.
Available embedding models on v1beta: gemini-embedding-001, gemini-embedding-2-preview.
embedder.py calls the v1beta embedContent REST endpoint directly via httpx.
outputDimensionality=768 keeps the vector(768) schema column unchanged.

---

## Live URLs

| Service | URL |
|---------|-----|
| Backend (Render) | https://rag-arena-ijz8.onrender.com |
| Frontend (Vercel) | https://rag-arena-three.vercel.app |
| Health check | https://rag-arena-ijz8.onrender.com/health |
| UptimeRobot monitor | Set to GET (not HEAD) — was showing 405 |

---

## Current State (last updated: 2026-05-21, Session 3)

### Completed this session
- [x] Backend Hardening: Implemented `asyncpg` connection pooling in `supabase_client.py` and `main.py` lifespan hooks.
- [x] Structured Logging: Added detailed context-aware logging with `request_id` tracing middleware.
- [x] Upload Size Caps: Added file validation limiting uploads to `50MB` for system safety.
- [x] Human Preference Voting: Implemented crowdsourced feedback logging APIs and Postgres `user_votes` database table.
- [x] Query History Replay: Implemented paginated history retrieval APIs filterable by document.
- [x] Recharts Telemetry Dashboard: Created an interactive frontend analytics dashboard visualizing latency trends, win-rates, query intent, and router advice splits.
- [x] Searchable History Panel: Designed a full-featured collapsible history explorer with replay comparison capability.
- [x] Research Methodology Hub: Built an interactive About page detailing the hypothesis and featuring a high-fidelity SVG workflow diagram.
- [x] Comprehensive Testing: Added robust test coverage for classifier decision boundaries and hierarchy parser tree-builders; all 29 tests verified passing.
- [x] Open-Source Ready: Created LICENSE (MIT) and CONTRIBUTING.md, and polished README.md.

### Still needed
- [ ] **USER ACTION:** Supabase SQL Editor: Run the `user_votes` schema definition located in `backend/db/schema.sql` lines 236–257 to activate live database storage for voting and history lists.
- [ ] **USER ACTION:** Render Dashboard env var: update `CORS_ORIGINS` to include `http://localhost:5173,https://rag-arena-three.vercel.app` (triggers automatic backend redeploy).
- [ ] **USER ACTION:** UptimeRobot monitor: change HTTP Method from `HEAD` to `GET` to fix the 405 Method Not Allowed error.
- [ ] **USER ACTION:** End-to-end test on production: Upload a financial report or technical paper, query the models, vote on responses, and watch the live analytics populate!

---

## ⚡ Next Session Starting Point

**Operations Check:**
1. Execute the `user_votes` SQL migrations in the Supabase Dashboard.
2. Verify that Render backend auto-redeployed successfully with the updated CORS origins.
3. Access https://rag-arena-three.vercel.app to run a query replay from the new History explorer.

---

## Key Bugs Fixed (reference for next session)

| Bug | Root cause | Fix |
|-----|-----------|-----|
| Gemini 404 on embedContent | text-embedding-004 not in quota; SDK uses v1beta | Rewrote embedder.py to call v1beta REST with gemini-embedding-001 |
| 'list has no .depth' | extract_hierarchy() returns tuple; whole tuple passed to build_tree() | Unpack: `hierarchy, structure_score = extract_hierarchy(parsed)` |
| 'Tenant or user not found' | asyncpg can't use Supabase PgBouncer (port 6543) | config.py `supabase_direct_url` property → db.PROJECT.supabase.co:5432 |
| NoneType has no .strip() | n.get('summary', '') returns None when key exists as None | Change to `(n.get('summary') or '').strip()` |
| tree-building unpacking | build_tree() returns (nodes, 0.0) tuple; score was being ignored | `tree_nodes, _ = build_tree(hierarchy, doc_id)` |

---

## Key Design Decisions (summary — see DECISIONS.md for full rationale)

1. Always run BOTH pipelines in parallel (`asyncio.gather`) — comparison data on every query
2. LLM navigates the tree (not embeddings) — section titles too short for reliable embedding
3. HNSW index (not IVFFlat) — works from first row, no training data needed
4. Adjacency list + TEXT path for tree — trivial inserts, prefix queries with LIKE
5. Supabase Storage for PDFs — Render disk is ephemeral
6. Internal node summaries cached at ingest — cheap navigation, never regenerated
7. Gemini embeddings (free, 768-dim) over OpenAI (costs money)
8. Groq for LLM (free tier) — 8B for nav/routing, 70B for final answers
9. Three-pass hierarchy extraction — handles TOC/font/regex PDFs
10. Render over Fly.io — no card required; cold starts mitigated by UptimeRobot

---

## File Map (critical files)

```
backend/
  main.py                     FastAPI entry point
  config.py                   Pydantic Settings + supabase_direct_url property
  api/documents.py            Upload + status + list + delete + _run_ingestion()
  api/queries.py              /compare (both pipelines parallel) + single endpoints
  db/supabase_client.py       Supabase REST client + asyncpg cosine_search()
  db/tree_store.py            insert/get children/subtree/leaf-texts
  ingestion/pdf_parser.py     PyMuPDF → ParsedDocument
  ingestion/chunker.py        Sliding window → Chunk list
  ingestion/embedder.py       httpx → Gemini v1beta embedContent (gemini-embedding-001)
  ingestion/hierarchy_extractor.py  3-pass extraction → (list[RawSection], score)
  ingestion/tree_builder.py   RawSection list → TreeNode tree with paths
  ingestion/node_summarizer.py  Groq summaries for internal nodes (ingest time)
  pipelines/vector_rag.py     embed → cosine search → Groq answer
  pipelines/vectorless_rag.py LLM tree navigation → leaf retrieval → Groq answer
  router/classifier.py        query_type + doc_type + decision matrix → RouterOutput
  llm/groq_client.py          Async Groq wrapper, retry on 429
  llm/prompts.py              All prompt templates as constants
  db/schema.sql               Postgres schema source of truth

frontend/
  src/api/client.js           axios wrapper — reads VITE_API_URL env var
  src/App.jsx                 Router + header + nav
  src/pages/Home.jsx          PDF upload + document list with live status polling
  src/pages/Compare.jsx       Side-by-side RAG comparison UI
  src/pages/Evaluation.jsx    Eval run launcher + results table
  src/components/ServerStatus.jsx  Pulsing health dot in header
  src/index.css               Glass morphism + glow utility classes
  tailwind.config.js          Custom colors: surface/accent/vector/vectorless
```

---

## Free Tier Limits to Watch

| Service | Limit | Warning Threshold |
|---------|-------|-------------------|
| Gemini embeddings | 1500 RPD, 100 RPM | 1200/day, 80/min |
| Groq TPM (8B) | 6,000 TPM | 5,000 TPM |
| Groq TPM (70B) | 14,400 TPM | 12,000 TPM |
| Supabase storage | 500 MB | 400 MB |
| Render free | 750 hrs/month compute | Always-on = ~744 hrs/month (tight) |

---

## Conventions

- All prompt templates live in `llm/prompts.py` — never inline in pipeline code
- Groq nav model for routing + navigation; answer model for final answers only
- Gemini embedder: individual embedContent calls, Semaphore(2), ssl='require' on asyncpg
- `structure_score` computed once at ingest in hierarchy_extractor.py, stored in DB
- DB upserts use unique constraints — safe to re-run ingestion
- asyncpg always uses `supabase_direct_url` (port 5432), never the pooler (port 6543)
