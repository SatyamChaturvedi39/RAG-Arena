"""
Converts flat RawSection list → TreeNode hierarchy with adjacency-list paths.

Path format: "1", "1.2", "1.2.3"
  - Root nodes:       "1", "2", "3"
  - Children of "2":  "2.1", "2.2"
  - Their children:   "2.1.1", "2.1.2"

This format allows prefix queries in Postgres:
  WHERE path LIKE '2.%'  →  all descendants of node "2"
"""
import uuid
from dataclasses import dataclass, field
from typing import Optional

from ingestion.hierarchy_extractor import RawSection


@dataclass
class TreeNode:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    document_id: str = ""
    parent_id: Optional[uuid.UUID] = None
    path: str = ""
    depth: int = 0
    position: int = 1
    title: str = ""
    text: Optional[str] = None
    summary: Optional[str] = None   # filled by node_summarizer.py
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    is_leaf: bool = False
    extraction_method: str = "toc"
    children: list["TreeNode"] = field(default_factory=list, repr=False)


def build_tree(
    sections: list[RawSection],
    document_id: str,
) -> tuple[list[TreeNode], float]:
    """
    Convert flat RawSection list into a TreeNode tree.
    Returns (all_nodes_flat, structure_score).

    The structure score was already computed by hierarchy_extractor,
    so we just re-read it from the first section's parent context here.
    We receive it as a parameter from the caller (documents.py).

    Algorithm:
    - Maintain a stack of (depth, node) representing the current ancestry path.
    - For each RawSection, pop the stack until the top is shallower than current depth.
    - The stack top becomes the parent.
    - Assign position as the count of siblings already added to that parent.
    """
    if not sections:
        return [], 0.0

    all_nodes: list[TreeNode] = []
    # stack: list of (depth, TreeNode)
    stack: list[tuple[int, TreeNode]] = []
    # sibling counters: parent_id → next position
    sibling_counter: dict[Optional[uuid.UUID], int] = {None: 0}

    for section in sections:
        # Pop stack until we find a node shallower than current section
        while stack and stack[-1][0] >= section.depth:
            stack.pop()

        parent_node = stack[-1][1] if stack else None
        parent_id = parent_node.id if parent_node else None

        # Assign position among siblings
        pos = sibling_counter.get(parent_id, 0) + 1
        sibling_counter[parent_id] = pos

        # Build path
        if parent_node is None:
            path = str(pos)
        else:
            path = f"{parent_node.path}.{pos}"

        node = TreeNode(
            document_id=document_id,
            parent_id=parent_id,
            path=path,
            depth=section.depth,
            position=pos,
            title=section.title,
            text=section.text if section.text else None,
            page_start=section.page_start,
            page_end=section.page_end,
            extraction_method=section.extraction_method,
        )

        if parent_node:
            parent_node.children.append(node)

        all_nodes.append(node)
        stack.append((section.depth, node))

    # Mark leaf nodes (nodes with no children)
    node_ids_with_children = {n.parent_id for n in all_nodes if n.parent_id}
    for node in all_nodes:
        node.is_leaf = node.id not in node_ids_with_children

    return all_nodes, 0.0  # score is computed by hierarchy_extractor, passed separately
