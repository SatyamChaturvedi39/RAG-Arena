-- RAG-Arena Database Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL editor → New query)
-- Supabase enables uuid-ossp by default; enable vector manually if needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- documents
-- Central registry. One row per uploaded PDF.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename        TEXT NOT NULL,
    file_size_bytes BIGINT,
    page_count      INTEGER,

    -- Classification (set during ingestion)
    doc_type        TEXT CHECK (doc_type IN ('financial', 'legal', 'technical', 'general')),
    structure_score FLOAT CHECK (structure_score BETWEEN 0 AND 1),

    -- Ingestion state machine
    -- pending → parsing → embedding → tree_building → ready | failed
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','parsing','embedding','tree_building','ready','failed')),
    progress_pct    INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    error_message   TEXT,

    -- Stats (filled after ingestion completes)
    total_chunks     INTEGER,
    total_tree_nodes INTEGER,
    max_tree_depth   INTEGER,
    avg_chunk_length INTEGER,

    -- Supabase Storage URL (never use local disk — Fly.io is ephemeral)
    storage_path    TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_status   ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- chunks
-- Vector RAG storage. One row per text chunk + embedding.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chunks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    chunk_index     INTEGER NOT NULL,   -- sequential order within document
    text            TEXT NOT NULL,
    page_num        INTEGER,
    char_start      INTEGER,
    char_end        INTEGER,
    token_count     INTEGER,

    -- Gemini text-embedding-004 → 768 dimensions
    embedding       vector(768),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(document_id, chunk_index)
);

-- HNSW index for cosine similarity search.
-- HNSW chosen over IVFFlat: no training data required (IVFFlat needs ≥1000 rows
-- before the index is useful). Works correctly from the very first document.
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- document_tree
-- Vectorless RAG storage. Hierarchical adjacency list.
--
-- path format: "1", "1.2", "1.2.3" — sibling position at each depth.
-- Prefix queries: WHERE path LIKE '1.2.%' retrieves all descendants of node 1.2.
-- Adjacency list chosen over nested sets: trivial inserts, adequate read
-- performance at portfolio scale (<10K nodes per document).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_tree (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    parent_id       UUID REFERENCES document_tree(id) ON DELETE CASCADE, -- NULL = root node
    path            TEXT NOT NULL,      -- "1.2.3" adjacency path
    depth           INTEGER NOT NULL CHECK (depth >= 0),  -- 0 = root
    position        INTEGER NOT NULL,   -- sibling order (1-indexed)

    -- Content
    title           TEXT NOT NULL,
    text            TEXT,               -- raw text (leaf nodes only)
    summary         TEXT,              -- LLM-generated 1-2 sentence summary (internal nodes)
                                        -- cached at ingest, never regenerated

    -- Metadata
    page_start      INTEGER,
    page_end        INTEGER,
    is_leaf         BOOLEAN NOT NULL DEFAULT FALSE,
    char_count      INTEGER,

    -- Which extraction pass found this node
    extraction_method TEXT CHECK (extraction_method IN ('toc', 'font_heuristic', 'regex')),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(document_id, path)
);

CREATE INDEX IF NOT EXISTS idx_tree_document ON document_tree(document_id);
CREATE INDEX IF NOT EXISTS idx_tree_parent   ON document_tree(parent_id);
-- text_pattern_ops enables LIKE 'prefix%' to use the index
CREATE INDEX IF NOT EXISTS idx_tree_path     ON document_tree(path text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_tree_depth    ON document_tree(document_id, depth);

-- ─────────────────────────────────────────────────────────────────────────────
-- queries
-- Log of every question asked, with router decision and user override.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id),

    query_text      TEXT NOT NULL,
    query_type      TEXT CHECK (query_type IN ('precise_factual', 'fuzzy_semantic', 'multi_hop', 'unknown')),

    -- Router output
    router_recommended  TEXT CHECK (router_recommended IN ('vector', 'vectorless')),
    router_confidence   FLOAT,
    router_reasoning    TEXT,
    router_signals      JSONB,         -- { structure_score, doc_type, query_type }

    -- User can override the router recommendation in the UI
    user_override       TEXT CHECK (user_override IN ('vector', 'vectorless', 'none')) DEFAULT 'none',

    session_id      TEXT,              -- client-side UUID grouping a user session
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queries_document ON queries(document_id);
CREATE INDEX IF NOT EXISTS idx_queries_created  ON queries(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- pipeline_results
-- One row per pipeline per query. Stores both answer and performance metrics.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id        UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
    pipeline        TEXT NOT NULL CHECK (pipeline IN ('vector', 'vectorless')),

    -- Answer
    answer          TEXT,

    -- Vector RAG specific
    chunks_retrieved        UUID[],         -- chunk IDs used
    top_similarity_score    FLOAT,          -- cosine similarity of best chunk

    -- Vectorless RAG specific
    nodes_visited           UUID[],         -- tree node IDs touched during navigation
    navigation_depth        INTEGER,        -- number of LLM navigation calls made
    navigation_path         TEXT,           -- human-readable: "PART II > Item 7 > Revenue"
    fallback_used           BOOLEAN DEFAULT FALSE,

    -- Performance
    latency_ms              INTEGER,
    llm_prompt_tokens       INTEGER,
    llm_completion_tokens   INTEGER,
    embedding_calls         INTEGER DEFAULT 0,   -- always 0 for vectorless

    -- Quality signals — filled by eval suite, NULL for live queries
    f1_score                FLOAT,
    exact_match             BOOLEAN,
    retrieval_precision     FLOAT,          -- fraction of retrieved context containing the answer

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(query_id, pipeline)
);

CREATE INDEX IF NOT EXISTS idx_results_query    ON pipeline_results(query_id);
CREATE INDEX IF NOT EXISTS idx_results_pipeline ON pipeline_results(pipeline);
CREATE INDEX IF NOT EXISTS idx_results_created  ON pipeline_results(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- evaluation_runs
-- Aggregate results from FinanceBench or custom dataset eval runs.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluation_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_name    TEXT NOT NULL,      -- 'financebench' | 'custom'
    dataset_version TEXT,
    status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),

    -- Aggregate metrics (filled when status = completed)
    total_questions         INTEGER,
    vector_f1_mean          FLOAT,
    vectorless_f1_mean      FLOAT,
    vector_em_rate          FLOAT,      -- exact match rate (0-1)
    vectorless_em_rate      FLOAT,
    vector_latency_p50      INTEGER,    -- milliseconds
    vectorless_latency_p50  INTEGER,
    vector_latency_p95      INTEGER,
    vectorless_latency_p95  INTEGER,

    -- What % of the time did the router pick the pipeline that scored higher F1?
    router_accuracy         FLOAT,

    -- Model config snapshot
    vector_embed_model      TEXT,
    nav_model               TEXT,
    answer_model            TEXT,

    notes           TEXT,
    run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
