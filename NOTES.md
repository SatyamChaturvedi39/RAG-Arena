# Session Notes

Running log of decisions, problems hit, and things learned while building RAG-Arena.
This is the raw material for an eventual blog post / write-up.

---

## Session 1 — 2026-04-15: Architecture + Full Backend Skeleton

### What was built
- Full monorepo structure created from scratch
- `backend/db/schema.sql` — all five tables with indexes, HNSW for pgvector, ltree-style path for document_tree
- Complete backend: FastAPI app, config, all API routes, DB layer, both RAG pipelines, router, all ingestion modules
- `DECISIONS.md` with 10 architectural decisions and their trade-offs

### Key decisions made this session

**HNSW vs IVFFlat**: Chose HNSW because IVFFlat requires a minimum row count before the index activates (rule of thumb: rows ≥ lists × 39). A demo with 1-5 documents would silently fall back to sequential scan. HNSW works from row 1.

**Adjacency list vs nested sets**: Nested sets are O(1) for subtree reads but O(N) for inserts (requires renumbering). Adjacency list with a TEXT path column (`WHERE path LIKE '1.2.%'`) is O(1) insert and O(log N) read with `text_pattern_ops` index. At <10K nodes, functionally identical — but insert simplicity is a big development win.

**Three-pass hierarchy extraction**: Different PDF generators have different metadata quality. SEC 10-Ks often have embedded TOC. Scanned docs have no TOC but consistent fonts. Plain PDFs have neither but use regex-matchable patterns (PART I, Item 7A). Single-pass would fail too often.

**Node summaries cached at ingest**: Internal tree nodes get a 1-2 sentence LLM summary at ingest time, stored in `document_tree.summary`. During navigation, the LLM reads these summaries (not full text), keeping navigation token cost low. Summaries are never regenerated — if a document is re-ingested, the old tree is replaced wholesale.

### Problems anticipated (not yet hit)

**Gemini SDK is synchronous**: Google's Python SDK has no async support. Every embedding call needs `asyncio.run_in_executor`. This is handled in `embedder.py` but worth watching — if the executor thread pool gets saturated under load, embedding latency will spike.

**Groq JSON mode reliability**: `chat_json()` in `groq_client.py` uses `response_format={"type": "json_object"}`. The 8B model occasionally produces JSON with comments or trailing commas that `json.loads` rejects. The `try/except` in `vectorless_rag.py`'s navigate function handles this by falling back to all nodes at the current level. Should be monitored in practice.

**Supabase connection pooler URL format**: The `SUPABASE_DB_URL` must be the **Transaction pooler** URL (port 6543), not the direct connection (port 5432) or Session pooler (port 5432). asyncpg connects to this for the pgvector query. Easy to misconfigure — added explicit comment in `.env.example`.

### Things learned

**PyMuPDF font flags**: The `flags` field in a PyMuPDF span is a bitmask. Bit 4 (value 16) = bold, bit 1 (value 2) = italic. `flags & 16` tests boldness. This isn't obvious from the docs.

**pgvector HNSW `ef_construction`**: Higher `ef_construction` = better index quality but slower build time. 64 is the recommended default. The actual query-time recall is controlled by `SET hnsw.ef_search = N` at query time (default 40). No need to tune at this scale.

**Gemini task types**: `embed_content` with `task_type="retrieval_document"` optimises the embedding for being retrieved. `task_type="retrieval_query"` optimises it for being the query vector. These are asymmetric — use document for chunks, query for the search vector. Using the wrong task type reduces retrieval quality by ~5-10%.

---

_Next session: unit tests for chunker + hierarchy_extractor, then set up Supabase project and test ingestion end-to-end with a real 10-K PDF._
