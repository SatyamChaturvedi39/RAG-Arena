"""
Sliding-window text chunker.

Splits document pages into overlapping chunks suitable for embedding.
Uses character count as a proxy for tokens (1 token ≈ 4 chars) to avoid
adding a tokenizer dependency.

Returns Chunk dataclasses, which are later filled with embeddings by embedder.py.
"""
import uuid
from dataclasses import dataclass, field
from typing import Optional

from ingestion.pdf_parser import PageData


@dataclass
class Chunk:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    document_id: str = ""
    chunk_index: int = 0
    text: str = ""
    page_num: Optional[int] = None
    char_start: int = 0
    char_end: int = 0
    token_count: int = 0
    embedding: Optional[list[float]] = None     # filled by embedder.py


def chunk_document(
    pages: list[PageData],
    document_id: str,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[Chunk]:
    """
    Merge all pages into a single text stream (with page-break markers),
    then apply sliding-window chunking.

    Page markers are included so we can recover page_num for each chunk
    and surface it in the UI ("found on page 12").
    """
    if chunk_size is None or overlap is None:
        from config import get_settings
        settings = get_settings()
        chunk_size = chunk_size if chunk_size is not None else settings.chunk_size
        overlap = overlap if overlap is not None else settings.chunk_overlap
    chunk_chars = chunk_size * 4   # tokens → chars (1 token ≈ 4 chars)
    overlap_chars = overlap * 4

    # Build full text with page boundary tracking
    full_text = ""
    page_boundaries: list[tuple[int, int]] = []  # (char_start, page_num)
    for page in pages:
        if page.text:
            page_boundaries.append((len(full_text), page.page_num))
            full_text += page.text + "\n\n"

    if not full_text.strip():
        return []

    def page_at(char_pos: int) -> int:
        """Return the page number that contains char_pos."""
        page_num = 0
        for start, pnum in page_boundaries:
            if start <= char_pos:
                page_num = pnum
            else:
                break
        return page_num

    chunks: list[Chunk] = []
    start = 0
    idx = 0

    while start < len(full_text):
        end = min(start + chunk_chars, len(full_text))

        # Don't cut mid-word — advance end to the next whitespace
        if end < len(full_text):
            while end < len(full_text) and not full_text[end].isspace():
                end += 1

        text_slice = full_text[start:end].strip()
        if text_slice:
            chunks.append(Chunk(
                document_id=document_id,
                chunk_index=idx,
                text=text_slice,
                page_num=page_at(start),
                char_start=start,
                char_end=end,
                token_count=max(1, len(text_slice) // 4),
            ))
            idx += 1

        # Slide forward, keeping overlap
        step = chunk_chars - overlap_chars
        start += step

    return chunks
