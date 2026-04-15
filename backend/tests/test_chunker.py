"""
Unit tests for the text chunker.
Run: cd backend && pytest tests/test_chunker.py -v
"""
from ingestion.pdf_parser import PageData
from ingestion.chunker import chunk_document


def make_pages(texts: list[str]) -> list[PageData]:
    return [PageData(page_num=i, text=t, blocks=[]) for i, t in enumerate(texts)]


def test_basic_chunking():
    pages = make_pages(["A " * 300])  # 600 chars ~ 150 tokens
    chunks = chunk_document(pages, "doc-1", chunk_size=100, overlap=10)
    assert len(chunks) >= 1
    for c in chunks:
        assert c.document_id == "doc-1"
        assert len(c.text) > 0
        assert c.chunk_index >= 0


def test_chunk_order():
    pages = make_pages(["word " * 500])
    chunks = chunk_document(pages, "doc-1", chunk_size=50, overlap=5)
    indices = [c.chunk_index for c in chunks]
    assert indices == list(range(len(indices))), "Chunk indices must be sequential"


def test_overlap_creates_extra_chunks():
    """With overlap, we should get more chunks than without."""
    pages = make_pages(["x " * 400])
    no_overlap = chunk_document(pages, "doc-1", chunk_size=100, overlap=0)
    with_overlap = chunk_document(pages, "doc-1", chunk_size=100, overlap=20)
    assert len(with_overlap) >= len(no_overlap)


def test_empty_document():
    pages = make_pages([""])
    chunks = chunk_document(pages, "doc-1", chunk_size=100, overlap=10)
    assert chunks == []


def test_page_num_assigned():
    pages = make_pages(["page zero text " * 50, "page one text " * 50])
    chunks = chunk_document(pages, "doc-1", chunk_size=50, overlap=0)
    assert any(c.page_num == 0 for c in chunks)
    assert any(c.page_num == 1 for c in chunks)


def test_char_bounds():
    pages = make_pages(["hello world " * 100])
    chunks = chunk_document(pages, "doc-1", chunk_size=50, overlap=0)
    for c in chunks:
        assert c.char_start < c.char_end


def test_token_count_estimated():
    pages = make_pages(["word " * 200])  # 1000 chars → ~250 tokens
    chunks = chunk_document(pages, "doc-1", chunk_size=200, overlap=0)
    for c in chunks:
        assert c.token_count > 0
