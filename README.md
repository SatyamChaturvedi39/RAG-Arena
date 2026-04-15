# RAG-Arena

A side-by-side benchmarking system for two RAG paradigms: classical **vector RAG** and from-scratch **vectorless RAG** (hierarchical tree navigation). Includes an intelligent router that picks the better approach per document and query, with transparent reasoning.

> **Live demo**: _coming soon_  
> **Demo video**: _coming soon_

---

## What is this?

Most RAG systems embed documents and retrieve by similarity. A newer approach ("vectorless RAG") skips embeddings entirely — it builds a hierarchical table-of-contents from a document and lets an LLM navigate to the right section like an expert scanning a book.

Each approach wins on different scenarios:
- **Vector RAG** → unstructured text, fuzzy/semantic queries
- **Vectorless RAG** → long structured documents (10-Ks, legal contracts, technical manuals) + precise factual queries

RAG-Arena lets you ask the same question against both pipelines and see which one wins — with latency, token cost, and accuracy metrics side by side.

---

## Architecture

```
React (Vercel) ──HTTPS──► FastAPI (Fly.io)
                                │
                ┌───────────────┼───────────────────┐
                │               │                   │
         Vector RAG     Vectorless RAG           Router
         Pipeline         Pipeline             Classifier
                │               │
                └───────────────┤
                                │
                    Supabase Postgres + pgvector
                    Groq API (LLM inference)
                    Gemini API (embeddings)
```

See [docs/architecture.png](docs/architecture.png) for the full diagram.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Backend | Python 3.11 + FastAPI |
| Frontend | React 18 + Tailwind CSS + Vite |
| Database | Supabase Postgres + pgvector |
| LLM | Groq (llama-3.1-8b-instant / llama-3.3-70b-versatile) |
| Embeddings | Gemini text-embedding-004 |
| PDF Parsing | PyMuPDF |
| Backend Host | Fly.io |
| Frontend Host | Vercel |

All free-tier. Zero spend.

---

## Quick Start (local)

### Prerequisites
- Python 3.11+
- Node 18+
- A Supabase project (free) with pgvector enabled
- Groq API key (free at console.groq.com)
- Gemini API key (free at aistudio.google.com)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy and fill in your keys
cp ../.env.example .env

# Run the schema: paste backend/db/schema.sql into Supabase SQL editor

uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Evaluation Results

_Populated after running the FinanceBench evaluation suite._

| Metric | Vector RAG | Vectorless RAG |
|--------|-----------|----------------|
| F1 (FinanceBench, n=50) | — | — |
| Exact Match Rate | — | — |
| Avg Latency (p50) | — | — |
| Router Accuracy | — | — |

---

## Repo Structure

```
├── backend/          # FastAPI app
│   ├── ingestion/    # PDF parsing, chunking, embedding, tree extraction
│   ├── pipelines/    # Vector RAG + Vectorless RAG implementations
│   ├── router/       # Intelligent pipeline selector
│   ├── db/           # Supabase client, tree store, schema
│   └── llm/          # Groq client, prompt templates
├── frontend/         # React + Tailwind UI
├── eval/             # FinanceBench runner + metrics
└── docs/             # Architecture diagram
```

See [DECISIONS.md](DECISIONS.md) for architectural trade-offs and why each choice was made.

---

## License

MIT
