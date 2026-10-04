from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import event
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

settings = get_settings()

# Engine creation
# SQLite does not support statement pooling like asyncpg; adjust connect_args
connect_args: dict[str, Any] = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.is_development and settings.LOG_LEVEL.upper() == "DEBUG",
    future=True,
    connect_args=connect_args,
)

# Enable WAL mode and foreign keys for SQLite in development
if settings.DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection: Any, connection_record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def execute_upsert(
    session: AsyncSession,
    model: Any,
    values: list[dict[str, Any]],
    index_elements: list[str],
    update_columns: list[str] | None = None,
) -> None:
    """Dialect-aware idempotent upsert for both SQLite and PostgreSQL.

    If update_columns is None, all columns in values except index_elements will be updated on conflict.
    If update_columns is empty, conflict performs DO NOTHING.
    """
    if not values:
        return

    bind = session.bind
    dialect_name = bind.dialect.name if bind else "sqlite"

    if dialect_name == "postgresql":
        pg_stmt = pg_insert(model).values(values)
        if update_columns is None:
            # Update all columns except primary/unique keys in index_elements
            first_val = values[0]
            update_columns = [k for k in first_val if k not in index_elements]

        if not update_columns:
            pg_stmt = pg_stmt.on_conflict_do_nothing(index_elements=index_elements)
        else:
            set_clause = {col: getattr(pg_stmt.excluded, col) for col in update_columns}
            pg_stmt = pg_stmt.on_conflict_do_update(
                index_elements=index_elements,
                set_=set_clause,
            )
        await session.execute(pg_stmt)

    else:
        # Default SQLite
        sqlite_stmt = sqlite_insert(model).values(values)
        if update_columns is None:
            first_val = values[0]
            update_columns = [k for k in first_val if k not in index_elements]

        if not update_columns:
            sqlite_stmt = sqlite_stmt.on_conflict_do_nothing(index_elements=index_elements)
        else:
            sqlite_set_clause = {col: getattr(sqlite_stmt.excluded, col) for col in update_columns}
            sqlite_stmt = sqlite_stmt.on_conflict_do_update(
                index_elements=index_elements,
                set_=sqlite_set_clause,
            )
        await session.execute(sqlite_stmt)
