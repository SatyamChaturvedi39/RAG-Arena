"""
Unit tests for the tree builder.
Run: cd backend && pytest tests/test_tree_builder.py -v
"""
from ingestion.hierarchy_extractor import RawSection
from ingestion.tree_builder import build_tree


def test_empty_sections():
    nodes, score = build_tree([], "doc-123")
    assert nodes == []
    assert score == 0.0


def test_flat_tree():
    """Flat hierarchy should have roots at position 1, 2, 3 and be leaves."""
    sections = [
        RawSection(title="Section 1", text="content 1", depth=0, page_start=0, page_end=0, extraction_method="toc"),
        RawSection(title="Section 2", text="content 2", depth=0, page_start=1, page_end=1, extraction_method="toc"),
    ]
    nodes, _ = build_tree(sections, "doc-123")
    assert len(nodes) == 2
    
    assert nodes[0].path == "1"
    assert nodes[0].depth == 0
    assert nodes[0].position == 1
    assert nodes[0].parent_id is None
    assert nodes[0].is_leaf is True

    assert nodes[1].path == "2"
    assert nodes[1].depth == 0
    assert nodes[1].position == 2
    assert nodes[1].parent_id is None
    assert nodes[1].is_leaf is True


def test_nested_tree():
    """Verify that hierarchy is correctly mapped to paths and parent_ids."""
    sections = [
        RawSection(title="Root 1", text="", depth=0, page_start=0, page_end=1, extraction_method="toc"),
        RawSection(title="Child 1.1", text="some text", depth=1, page_start=0, page_end=0, extraction_method="toc"),
        RawSection(title="Child 1.2", text="", depth=1, page_start=1, page_end=1, extraction_method="toc"),
        RawSection(title="Grandchild 1.2.1", text="nested", depth=2, page_start=1, page_end=1, extraction_method="toc"),
        RawSection(title="Root 2", text="flat root", depth=0, page_start=2, page_end=2, extraction_method="toc"),
    ]
    nodes, _ = build_tree(sections, "doc-123")
    assert len(nodes) == 5

    # Root 1
    assert nodes[0].title == "Root 1"
    assert nodes[0].path == "1"
    assert nodes[0].is_leaf is False
    assert len(nodes[0].children) == 2

    # Child 1.1
    assert nodes[1].title == "Child 1.1"
    assert nodes[1].path == "1.1"
    assert nodes[1].parent_id == nodes[0].id
    assert nodes[1].is_leaf is True

    # Child 1.2
    assert nodes[2].title == "Child 1.2"
    assert nodes[2].path == "1.2"
    assert nodes[2].parent_id == nodes[0].id
    assert nodes[2].is_leaf is False
    assert len(nodes[2].children) == 1

    # Grandchild 1.2.1
    assert nodes[3].title == "Grandchild 1.2.1"
    assert nodes[3].path == "1.2.1"
    assert nodes[3].parent_id == nodes[2].id
    assert nodes[3].is_leaf is True

    # Root 2
    assert nodes[4].title == "Root 2"
    assert nodes[4].path == "2"
    assert nodes[4].parent_id is None
    assert nodes[4].is_leaf is True
