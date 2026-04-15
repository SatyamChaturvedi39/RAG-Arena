"""
PDF parser using PyMuPDF (fitz).

Returns a ParsedDocument with:
- pages: list of PageData (text + font blocks for hierarchy extraction)
- page_count
- first_page_text: used for doc type classification
- toc: raw table of contents from the PDF (may be empty)
"""
import io
from dataclasses import dataclass, field

import fitz  # PyMuPDF


@dataclass
class FontBlock:
    """A single text block with font metadata. Used by hierarchy_extractor."""
    text: str
    size: float
    flags: int      # bit 4 = bold (16), bit 1 = italic (2)
    page_num: int
    bbox: tuple     # (x0, y0, x1, y1)

    @property
    def is_bold(self) -> bool:
        return bool(self.flags & 16)

    @property
    def is_italic(self) -> bool:
        return bool(self.flags & 2)


@dataclass
class PageData:
    page_num: int       # 0-indexed
    text: str           # plain text for chunking
    blocks: list[FontBlock] = field(default_factory=list)   # rich font blocks for hierarchy extraction


@dataclass
class ParsedDocument:
    pages: list[PageData]
    page_count: int
    toc: list           # [[level, title, page], ...] — may be empty
    first_page_text: str


def parse_pdf(pdf_bytes: bytes) -> ParsedDocument:
    """
    Parse a PDF from raw bytes. Extracts:
    - Per-page plain text (for chunking)
    - Per-page font blocks (for hierarchy extraction)
    - Embedded TOC (if present)
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    toc = doc.get_toc(simple=False)  # [[level, title, page, dest], ...]
    # Normalise to [level, title, page] triples
    toc_simple = [[entry[0], entry[1], entry[2]] for entry in toc]

    pages: list[PageData] = []
    for page_num in range(len(doc)):
        page = doc[page_num]

        # Plain text — used for chunking
        plain_text = page.get_text("text").strip()

        # Rich dict blocks — used for hierarchy extraction
        raw_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
        font_blocks: list[FontBlock] = []

        for block in raw_dict.get("blocks", []):
            if block.get("type") != 0:  # 0 = text, 1 = image
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    font_blocks.append(FontBlock(
                        text=text,
                        size=round(span.get("size", 0), 1),
                        flags=span.get("flags", 0),
                        page_num=page_num,
                        bbox=tuple(span.get("bbox", (0, 0, 0, 0))),
                    ))

        pages.append(PageData(
            page_num=page_num,
            text=plain_text,
            blocks=font_blocks,
        ))

    doc.close()

    first_page_text = pages[0].text if pages else ""
    return ParsedDocument(
        pages=pages,
        page_count=len(pages),
        toc=toc_simple,
        first_page_text=first_page_text,
    )
