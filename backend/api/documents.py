import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from config import get_settings
from db.supabase_client import get_client

router = APIRouter()
settings = get_settings()


# ─── Response models ─────────────────────────────────────────────────────────

class DocumentUploadResponse(BaseModel):
    document_id: str
    status: str
    message: str


class DocumentStatusResponse(BaseModel):
    id: str
    filename: str
    status: str
    progress_pct: int
    doc_type: Optional[str]
    structure_score: Optional[float]
    total_chunks: Optional[int]
    total_tree_nodes: Optional[int]
    page_count: Optional[int]
    error_message: Optional[str]


class DocumentListResponse(BaseModel):
    items: list[DocumentStatusResponse]
    total: int


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    doc_type_hint: Optional[str] = Form(None),
):
    """
    Upload a PDF. Saves to Supabase Storage and kicks off background ingestion
    (chunking + embedding for vector RAG, hierarchy extraction for vectorless RAG).
    Poll GET /documents/{id}/status to track progress.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file.")

    # Create document record in DB
    client = get_client()
    doc_id = str(uuid.uuid4())
    storage_path = f"pdfs/{doc_id}/{file.filename}"

    # Upload to Supabase Storage
    client.storage.from_("documents").upload(
        path=storage_path,
        file=contents,
        file_options={"content-type": "application/pdf"},
    )

    # Insert document row
    client.table("documents").insert({
        "id": doc_id,
        "filename": file.filename,
        "file_size_bytes": len(contents),
        "storage_path": storage_path,
        "status": "pending",
        "progress_pct": 0,
    }).execute()

    # Kick off ingestion in the background
    background_tasks.add_task(_run_ingestion, doc_id, contents, doc_type_hint)

    return DocumentUploadResponse(
        document_id=doc_id,
        status="pending",
        message="Ingestion started. Poll /documents/{id}/status for progress.",
    )


@router.get("/{doc_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(doc_id: str):
    client = get_client()
    result = (
        client.table("documents")
        .select("id,filename,status,progress_pct,doc_type,structure_score,total_chunks,total_tree_nodes,page_count,error_message")
        .eq("id", doc_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    return DocumentStatusResponse(**result.data)


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
):
    client = get_client()
    query = client.table("documents").select(
        "id,filename,status,progress_pct,doc_type,structure_score,total_chunks,total_tree_nodes,page_count,error_message",
        count="exact",
    ).order("created_at", desc=True).range(offset, offset + limit - 1)

    if status:
        query = query.eq("status", status)

    result = query.execute()
    return DocumentListResponse(items=result.data or [], total=result.count or 0)


@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    client = get_client()
    # Fetch storage_path first so we can delete from Storage
    result = client.table("documents").select("storage_path").eq("id", doc_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    storage_path = result.data.get("storage_path")
    if storage_path:
        try:
            client.storage.from_("documents").remove([storage_path])
        except Exception:
            pass  # best-effort Storage cleanup

    # Cascade deletes chunks, document_tree, queries, pipeline_results
    client.table("documents").delete().eq("id", doc_id).execute()
    return {"success": True}


# ─── Background ingestion task ────────────────────────────────────────────────

async def _run_ingestion(doc_id: str, pdf_bytes: bytes, doc_type_hint: Optional[str]):
    """
    Full ingestion pipeline run in background:
    1. Parse PDF
    2. Build chunks + embed (vector RAG)
    3. Extract hierarchy + build tree (vectorless RAG)
    4. Mark document ready
    """
    client = get_client()

    def _update(status: str, pct: int, **kwargs):
        payload = {"status": status, "progress_pct": pct, **kwargs}
        client.table("documents").update(payload).eq("id", doc_id).execute()

    try:
        # ── 1. Parse PDF ──────────────────────────────────────────────────────
        _update("parsing", 5)
        from ingestion.pdf_parser import parse_pdf
        parsed = parse_pdf(pdf_bytes)
        _update("parsing", 15, page_count=parsed.page_count)

        # ── 2. Classify doc type ──────────────────────────────────────────────
        from router.classifier import classify_doc_type
        doc_type = doc_type_hint or classify_doc_type(parsed.first_page_text, parsed.filename if hasattr(parsed, "filename") else "")
        client.table("documents").update({"doc_type": doc_type}).eq("id", doc_id).execute()

        # ── 3. Chunk + embed (vector RAG path) ────────────────────────────────
        _update("embedding", 20)
        from ingestion.chunker import chunk_document
        from ingestion.embedder import embed_chunks
        from db.supabase_client import insert_chunks

        chunks = chunk_document(parsed.pages, doc_id)
        _update("embedding", 30, total_chunks=len(chunks))

        # embed_chunks fills in chunk.embedding for each chunk
        embedded_chunks = await embed_chunks(chunks)
        _update("embedding", 60)

        insert_chunks(embedded_chunks)
        _update("embedding", 65)

        # ── 4. Extract hierarchy + build tree (vectorless RAG path) ──────────
        _update("tree_building", 68)
        from ingestion.hierarchy_extractor import extract_hierarchy
        from ingestion.tree_builder import build_tree
        from db.tree_store import insert_tree
        from ingestion.node_summarizer import summarize_internal_nodes

        hierarchy = extract_hierarchy(parsed)
        tree_nodes, structure_score = build_tree(hierarchy, doc_id)
        _update("tree_building", 75, structure_score=structure_score)

        # Generate summaries for internal nodes (cached in DB)
        tree_nodes = await summarize_internal_nodes(tree_nodes)
        _update("tree_building", 88)

        insert_tree(tree_nodes)
        total_tree_nodes = len(tree_nodes)
        max_depth = max((n.depth for n in tree_nodes), default=0)

        # ── 5. Mark ready ─────────────────────────────────────────────────────
        _update(
            "ready", 100,
            structure_score=structure_score,
            total_chunks=len(chunks),
            total_tree_nodes=total_tree_nodes,
            max_tree_depth=max_depth,
        )

    except Exception as e:
        client.table("documents").update({
            "status": "failed",
            "error_message": str(e)[:500],
        }).eq("id", doc_id).execute()
        raise
