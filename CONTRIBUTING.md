# Contributing to RAG-Arena

Thank you for your interest in contributing to RAG-Arena! This project is designed as an open-source research and engineering playground for evaluating Retrieval-Augmented Generation (RAG) paradigms.

---

## 🛠️ Development Setup

The project is split into a **FastAPI backend** and a **React + Vite frontend**.

### Prerequisites
- Python 3.10 or 3.11
- Node.js 18+ and npm
- A Supabase project (Postgres with pgvector enabled)
- A Groq API Key (for LLM inference)
- A Google Gemini API Key (for embeddings)

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment variables template and fill in your values:
   ```bash
   cp .env.example .env
   ```
5. Start the development server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Access the UI at `http://localhost:5173`. The Vite proxy will automatically forward API requests to `http://localhost:8000/api/*`.

---

## 🌲 Adding a New Pipeline Type

RAG-Arena is modular. To add a new retrieval or generation pipeline:

1. Create your pipeline logic in a new file in `backend/pipelines/` (e.g., `hybrid_rag.py`).
2. Implement your entrypoint function using a schema consistent with `PipelineResult` in `backend/api/queries.py`.
3. Update `POST /query/compare` in `backend/api/queries.py` to include your new pipeline in the parallel execution block:
   ```python
   # Example: Adding hybrid RAG
   from pipelines.hybrid_rag import run_hybrid_rag
   hybrid_task = asyncio.create_task(_safe_run(run_hybrid_rag, doc_id, query))
   ```
4. Update the schema files (`schema.sql` and the database table checklists) to support recording metrics for your pipeline.

---
 
## 🎨 Code Style Guidelines

- **Python**: Follow PEP 8 style guide. Use structured logging (`logging` module) instead of raw `print()` statements. Maintain type annotations where possible.
- **React**: Write functional components with hooks. Use Tailwind utility classes or custom classes declared in `index.css`. All interactive components must be fully mobile responsive.
- **Database**: Write standard, clean Postgres SQL. Ensure proper indices exist for all foreign keys and query patterns in `schema.sql`.
