from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    supabase_db_url: str

    # LLM providers
    groq_api_key: str
    gemini_api_key: str

    # App
    cors_origins: str = "http://localhost:5173"
    app_env: str = "development"

    # Model config — can be overridden via env vars without code changes
    groq_nav_model: str = "llama-3.1-8b-instant"       # routing + tree navigation (fast/cheap)
    groq_answer_model: str = "llama-3.3-70b-versatile" # final answer generation (quality)
    # gemini-embedding-001 is the available free-tier model (v1beta, supports embedContent)
    # text-embedding-004 is NOT available with this key's quota
    gemini_embed_model: str = "gemini-embedding-001"
    embed_output_dimensions: int = 768   # Matryoshka truncation — matches vector(768) schema

    # Chunking defaults
    chunk_size: int = 512       # tokens (approximate, using char heuristic: 1 token ≈ 4 chars)
    chunk_overlap: int = 64

    # Vector retrieval default
    top_k: int = 5

    # Vectorless navigation limits
    max_nav_depth: int = 3
    max_nav_calls: int = 5
    nav_timeout_seconds: int = 15

    # Gemini embedding rate limiting
    # Free tier: 100 RPM. We use Semaphore(2) on batch calls (100 chunks/batch)
    # → max 2 concurrent batch requests = 200 chunks/sec theoretical, but API latency
    # means real throughput is ~2-3 batches/min, well under the 100 RPM limit.
    embed_batch_semaphore: int = 2
    embed_batch_size: int = 100

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def supabase_direct_url(self) -> str:
        """
        Derive the direct Postgres connection URL from the pooler URL.
        asyncpg cannot use Supabase's PgBouncer transaction pooler (port 6543)
        — it rejects the connection with "Tenant or user not found".
        The direct host (db.PROJECT.supabase.co:5432) works correctly.

        Pooler format:  postgresql://postgres.PROJECT:PASS@pooler.supabase.com:6543/postgres
        Direct format:  postgresql://postgres:PASS@db.PROJECT.supabase.co:5432/postgres
        """
        import re
        m = re.match(r"postgresql://postgres\.(\w+):([^@]+)@", self.supabase_db_url)
        if m:
            project_ref, password = m.group(1), m.group(2)
            return f"postgresql://postgres:{password}@db.{project_ref}.supabase.co:5432/postgres"
        return self.supabase_db_url  # fallback: use as-is


@lru_cache
def get_settings() -> Settings:
    return Settings()
