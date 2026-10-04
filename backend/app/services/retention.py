import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Project, Span, Trace

logger = logging.getLogger(__name__)


class RetentionService:
    @staticmethod
    async def run_retention_purge(db: AsyncSession) -> tuple[int, int]:
        """Purges traces and spans older than each project's configured retention_days.

        Returns:
            tuple[int, int]: (traces_deleted, spans_deleted)
        """
        now = datetime.now(UTC)
        projects_res = await db.execute(select(Project))
        projects = projects_res.scalars().all()

        total_traces_deleted = 0
        total_spans_deleted = 0

        for proj in projects:
            retention_days = max(1, proj.retention_days)
            cutoff = now - timedelta(days=retention_days)

            # 1. Delete expired spans
            del_spans_stmt = (
                delete(Span)
                .where(Span.project_id == proj.id, Span.started_at < cutoff)
            )
            spans_res = await db.execute(del_spans_stmt)
            spans_count = int(getattr(spans_res, "rowcount", 0) or 0)
            total_spans_deleted += max(0, spans_count)

            # 2. Delete expired traces
            del_traces_stmt = (
                delete(Trace)
                .where(Trace.project_id == proj.id, Trace.started_at < cutoff)
            )
            traces_res = await db.execute(del_traces_stmt)
            traces_count = int(getattr(traces_res, "rowcount", 0) or 0)
            total_traces_deleted += max(0, traces_count)

        await db.commit()
        logger.info(
            "Retention purge completed: %d traces and %d spans deleted",
            total_traces_deleted,
            total_spans_deleted,
        )
        return total_traces_deleted, total_spans_deleted
