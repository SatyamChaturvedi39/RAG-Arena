"""
CRUD operations for the document_tree table.
"""
from db.supabase_client import get_client
from ingestion.tree_builder import TreeNode


def insert_tree(nodes: list[TreeNode]) -> None:
    """Bulk-insert all tree nodes for a document."""
    client = get_client()
    rows = [
        {
            "id": str(n.id),
            "document_id": n.document_id,
            "parent_id": str(n.parent_id) if n.parent_id else None,
            "path": n.path,
            "depth": n.depth,
            "position": n.position,
            "title": n.title,
            "text": n.text,
            "summary": n.summary,
            "page_start": n.page_start,
            "page_end": n.page_end,
            "is_leaf": n.is_leaf,
            "char_count": len(n.text) if n.text else 0,
            "extraction_method": n.extraction_method,
        }
        for n in nodes
    ]
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        client.table("document_tree").upsert(rows[i : i + batch_size]).execute()


def get_children(document_id: str, parent_id: str | None) -> list[dict]:
    """
    Fetch direct children of a node.
    parent_id=None fetches root nodes (depth 0).
    """
    client = get_client()
    query = client.table("document_tree").select(
        "id,path,depth,position,title,summary,is_leaf,page_start,page_end"
    ).eq("document_id", document_id).order("position")

    if parent_id is None:
        query = query.is_("parent_id", "null")
    else:
        query = query.eq("parent_id", parent_id)

    return query.execute().data or []


def get_subtree(document_id: str, path_prefix: str) -> list[dict]:
    """
    Fetch a node and all its descendants by path prefix.
    e.g. path_prefix="1.2" returns "1.2", "1.2.1", "1.2.1.1", etc.
    """
    client = get_client()
    # path_prefix% catches the node itself and all descendants
    result = (
        client.table("document_tree")
        .select("id,path,depth,title,text,summary,is_leaf,page_start,page_end")
        .eq("document_id", document_id)
        .like("path", f"{path_prefix}%")
        .order("path")
        .execute()
    )
    return result.data or []


def get_leaf_texts(document_id: str, node_ids: list[str]) -> list[dict]:
    """Fetch full text for a list of leaf node IDs."""
    if not node_ids:
        return []
    client = get_client()
    result = (
        client.table("document_tree")
        .select("id,title,text,path,page_start,page_end")
        .eq("document_id", document_id)
        .in_("id", node_ids)
        .execute()
    )
    return result.data or []


def get_root_nodes(document_id: str) -> list[dict]:
    """Convenience: fetch all depth-0 nodes (top-level sections)."""
    return get_children(document_id, parent_id=None)
