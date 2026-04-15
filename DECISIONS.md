# Architectural Decisions

This file documents every significant technical choice made in RAG-Arena, with the trade-offs considered. The goal is to make the reasoning transparent — both for collaborators and as a portfolio artifact showing engineering judgment.

---

## 1. Always run both pipelines in parallel, not route to one

**Decision**: `POST /query/compare` uses `asyncio.gather` to run vector RAG and vectorless RAG simultaneously, regardless of what the router recommends. The router recommendation is displayed in the UI as advisory context, not a gate.

**Why**: The entire point of this project is comparison. If we routed to only one pipeline, we'd lose the ability to collect comparison data on every query. Running both also lets users see when the "wrong" pipeline wins, which is more insightful than always being shown the "correct" answer.

**Trade-off**: Doubles LLM token consumption and latency for every query. Acceptable for a demo project where insight > throughput. In production, you'd add a "comparison mode" toggle.

---

## 2. LLM-guided tree navigation over embedding-based tree search

**Decision**: The vectorless pipeline uses an LLM to navigate the document tree at each level, not embeddings.

**Why**: Section titles in structured professional documents are often extremely short and domain-specific — "Item 7A", "Note 14", "PART III". These strings have almost no semantic content for an embedding model to latch onto. A query like "What was the revenue in Q3?" maps poorly to the embedding of "Item 7" but maps well to an LLM's understanding that financial results are in Item 7 of a 10-K.

**Trade-off**: Each navigation level consumes a Groq API call (~300–500 tokens). Capped at 5 calls per query to stay within free tier. The cost is LLM calls rather than vector computation — a fundamentally different resource profile.

---

## 3. pgvector HNSW over IVFFlat

**Decision**: The chunks table uses an HNSW index for approximate nearest-neighbor search.

**Why**: IVFFlat requires a minimum number of rows before the index is useful (the rule of thumb is ≥ `lists * 39` rows, where lists ≥ sqrt(N)). For a demo with 1–5 documents and perhaps 500–2000 chunks, the IVFFlat index would often not be used at all, falling back to a sequential scan. HNSW works correctly from the first row and has consistently better recall at the same ef_search setting.

**Trade-off**: HNSW uses more memory (~2x the vector storage). At portfolio scale (< 50MB of vectors), this is irrelevant.

---

## 4. Adjacency list over nested sets for the document tree

**Decision**: `document_tree` uses parent_id + path TEXT column (adjacency list with materialised path), not nested sets (left/right integers).

**Why**: Nested sets make subtree reads O(1) but inserts O(N) — you have to renumber every row. Adjacency list with a path prefix (WHERE path LIKE '1.2.%') makes inserts O(1) and subtree reads O(log N) with the text_pattern_ops index. At portfolio scale (<10K nodes per document), the difference is imperceptible, but the insert simplicity is a major development speed win.

**Trade-off**: Deleting a subtree requires a recursive CTE or application-level traversal. This is handled by Postgres `ON DELETE CASCADE` on the parent_id FK, so it's not a practical concern.

---

## 5. Gemini for embeddings over OpenAI text-embedding-3-small

**Decision**: Using Google's `text-embedding-004` (768-dim) for all embedding operations.

**Why**: OpenAI embeddings cost money — even text-embedding-3-small at $0.02/1M tokens adds up quickly in a portfolio project with many test documents. Gemini text-embedding-004 has a free tier (1500 RPD), produces 768-dimensional vectors, and performs comparably to OpenAI's models on retrieval benchmarks. The MTEB leaderboard shows text-embedding-004 competitive with text-embedding-3-small.

**Trade-off**: Gemini's Python SDK is synchronous, requiring `asyncio.run_in_executor` wrappers. The 1500 RPD limit is a real constraint: at 100 chunks per batch, that's ~1500 chunks/day maximum, limiting to ~3 medium documents per day.

---

## 6. Groq over OpenAI/Anthropic for LLM inference

**Decision**: All LLM calls (routing, navigation, answer generation) use Groq's free API tier.

**Why**: Groq offers llama-3.1-8b-instant and llama-3.3-70b-versatile on a free tier with generous rate limits (6,000–14,400 TPM). OpenAI and Anthropic have no meaningful free tier for a project that makes 5–10 LLM calls per user query. Groq's inference is also extremely fast (usually <1s for 8B, <3s for 70B) which improves the demo experience.

**Trade-off**: Groq models are open-source LLMs (Llama 3), not frontier models. For precise answer generation on financial documents, this means occasional factual errors on edge cases. Acceptable for a portfolio demo; a production system would use Claude or GPT-4.

**Model split**: llama-3.1-8b-instant for routing and tree navigation (speed + cost), llama-3.3-70b-versatile for final answer generation (quality matters for the output users see).

---

## 7. Supabase Storage for PDFs, not local disk

**Decision**: Uploaded PDFs are stored in Supabase Storage (S3-compatible), not on the Fly.io instance's local filesystem.

**Why**: Fly.io free tier VMs have ephemeral local storage — files written to disk are lost on every deploy and machine restart. A demo where uploaded documents disappear on deploy is broken. Supabase Storage gives 1GB free, is S3-compatible, and persists independently of the compute layer.

**Trade-off**: Ingestion requires downloading the PDF from Storage before processing, adding ~1-2 seconds latency for large files. Acceptable for background ingestion tasks.

---

## 8. Three-pass hierarchy extraction with priority ordering

**Decision**: Hierarchy extraction tries three approaches in order: embedded TOC → font heuristics → regex patterns. The first pass that produces ≥3 sections wins.

**Why**: Different PDF generators produce different metadata quality. SEC-filed 10-Ks often have a proper embedded TOC (Pass 1). Scanned/OCR'd documents often have no TOC but consistent heading fonts (Pass 2). Plain text PDFs may have no font metadata but use numbered section conventions (Pass 3). A single method would fail on too many document types.

**Trade-off**: Three passes run synchronously during ingestion, but since this is a background task the extra latency (typically <2 seconds) is invisible to users.

---

## 9. React + Vite over Next.js

**Decision**: Frontend is a plain Vite React SPA, not Next.js.

**Why**: This is a client-side application that talks to a FastAPI backend. There is no benefit from SSR, SSG, or file-system routing. Next.js adds significant bundle complexity and framework overhead for no gain here. Vite produces a faster dev experience and smaller production builds.

**Trade-off**: No file-based routing means manual React Router setup. Acceptable — the app has only three routes.

---

## 10. Fly.io over Render for backend hosting

**Decision**: FastAPI backend is deployed on Fly.io, not Render.

**Why**: Render's free tier spins down instances after 15 minutes of inactivity, causing 30-90 second cold starts. This is catastrophic for a demo: a recruiter visiting the live URL gets a broken experience for the first ~1 minute. Fly.io's free tier (3 shared-cpu-1x VMs) does not have cold starts with `auto_stop_machines = false`. The fly.toml config keeps one machine running at all times.

**Trade-off**: Fly.io requires `flyctl` CLI and a `fly.toml` config, which is slightly more complex than Render's GitHub integration. Worth it for the cold-start elimination.
