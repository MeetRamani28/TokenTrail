import logging

from sqlalchemy import select

from app.core.db import AsyncSessionLocal, engine
from app.models.base import Base
from app.models.models import ApiKey, ModelPrice, Project, User
from app.services.api_key import hash_api_key

logger = logging.getLogger(__name__)


async def seed_dev_defaults() -> None:
    """Auto-seeds default dev user, project, API key, and model prices for local development."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Dev user
        user_res = await session.execute(select(User).where(User.clerk_user_id == "dev_user_admin"))
        user = user_res.scalar_one_or_none()
        if not user:
            user = User(clerk_user_id="dev_user_admin")
            session.add(user)
            await session.flush()

        # 2. Default project
        proj_res = await session.execute(select(Project).where(Project.owner_user_id == user.id))
        project = proj_res.scalars().first()
        if not project:
            project = Project(owner_user_id=user.id, name="Default Project", retention_days=30)
            session.add(project)
            await session.flush()

        # 3. Default API key: tt_live_dev_test_key
        raw_key = "tt_live_dev_test_key"
        key_hash = hash_api_key(raw_key)
        key_res = await session.execute(select(ApiKey).where(ApiKey.key_hash == key_hash))
        if not key_res.scalar_one_or_none():
            api_key = ApiKey(
                project_id=project.id,
                name="Default Dev Key",
                key_hash=key_hash,
                key_prefix=raw_key[:14],
            )
            session.add(api_key)
            logger.info("Auto-seeded dev API key: %s", raw_key)

        # 4. Default model prices
        default_prices = [
            ("groq", "llama-3.3-70b-versatile", 0.59, 0.79),
            ("groq", "mixtral-8x7b-32768", 0.24, 0.24),
            ("groq", "gemma2-9b-it", 0.20, 0.20),
        ]
        for provider, model, input_rate, output_rate in default_prices:
            price_res = await session.execute(
                select(ModelPrice).where(ModelPrice.provider == provider, ModelPrice.model == model)
            )
            if not price_res.scalar_one_or_none():
                session.add(
                    ModelPrice(
                        provider=provider,
                        model=model,
                        input_price_per_1m=input_rate,
                        output_price_per_1m=output_rate,
                    )
                )

        await session.commit()
