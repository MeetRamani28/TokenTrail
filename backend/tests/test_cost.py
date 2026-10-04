from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ModelPrice
from app.services.cost import calculate_cost, seed_default_prices_if_empty


@pytest.mark.asyncio
async def test_hand_calculated_cost_samples(db_session: AsyncSession) -> None:
    """Verifies that 10 hand-calculated call costs match 100% down to the exact decimal."""
    # Seed default pricing catalog
    await seed_default_prices_if_empty(db_session)

    # 1. Groq Llama 3.3 70B: 1M prompt ($0.59) + 1M completion ($0.79) = 1.38 USD
    cost1, est1 = await calculate_cost(
        session=db_session,
        model="llama-3.3-70b-versatile",
        provider="groq",
        prompt_tokens=1_000_000,
        completion_tokens=1_000_000,
    )
    assert est1 is False
    assert cost1 == pytest.approx(1.3800000)

    # 2. Groq Llama 3.3 70B typical call: 1,500 prompt + 350 completion
    # input = 1500 * 0.59 / 1e6 = 0.000885; output = 350 * 0.79 / 1e6 = 0.0002765 -> total = 0.0011615
    cost2, est2 = await calculate_cost(
        session=db_session,
        model="llama-3.3-70b-versatile",
        provider="groq",
        prompt_tokens=1_500,
        completion_tokens=350,
    )
    assert est2 is False
    assert cost2 == pytest.approx(0.0011615)

    # 3. Groq Llama 3.1 8B ($0.05 / 1M prompt, $0.08 / 1M output): 10,000 prompt + 2,500 completion
    # input = 10000 * 0.05 / 1e6 = 0.0005; output = 2500 * 0.08 / 1e6 = 0.0002 -> total = 0.0007
    cost3, est3 = await calculate_cost(
        session=db_session,
        model="llama-3.1-8b-instant",
        provider="groq",
        prompt_tokens=10_000,
        completion_tokens=2_500,
    )
    assert est3 is False
    assert cost3 == pytest.approx(0.0007000)

    # 4. Groq Llama 3.1 8B prompt-only evaluation (0 completion tokens): 500 prompt tokens
    # 500 * 0.05 / 1e6 = 0.000025
    cost4, est4 = await calculate_cost(
        session=db_session,
        model="llama-3.1-8b-instant",
        provider="groq",
        prompt_tokens=500,
        completion_tokens=0,
    )
    assert est4 is False
    assert cost4 == pytest.approx(0.0000250)

    # 5. Groq Mixtral 8x7B ($0.24 prompt, $0.24 output): 8,000 prompt + 12,000 completion (20,000 total)
    # 20000 * 0.24 / 1e6 = 0.0048
    cost5, est5 = await calculate_cost(
        session=db_session,
        model="mixtral-8x7b-32768",
        provider="groq",
        prompt_tokens=8_000,
        completion_tokens=12_000,
    )
    assert est5 is False
    assert cost5 == pytest.approx(0.0048000)

    # 6. Cohere Command R ($0.50 prompt, $1.50 output): 4,000 prompt + 1,000 completion
    # input = 4000 * 0.50 / 1e6 = 0.002; output = 1000 * 1.50 / 1e6 = 0.0015 -> total = 0.0035
    cost6, est6 = await calculate_cost(
        session=db_session,
        model="command-r",
        provider="cohere",
        prompt_tokens=4_000,
        completion_tokens=1_000,
    )
    assert est6 is False
    assert cost6 == pytest.approx(0.0035000)

    # 7. Cohere Command R+ ($2.50 prompt, $10.00 output): 2,000 prompt + 500 completion
    # input = 2000 * 2.50 / 1e6 = 0.005; output = 500 * 10.00 / 1e6 = 0.005 -> total = 0.010
    cost7, est7 = await calculate_cost(
        session=db_session,
        model="command-r-plus",
        provider="cohere",
        prompt_tokens=2_000,
        completion_tokens=500,
    )
    assert est7 is False
    assert cost7 == pytest.approx(0.0100000)

    # 8. Date-effective pricing lookup:
    # Model price in Jan 2026 ($1.00 / $2.00) vs June 2026 ($0.50 / $1.00)
    jan_price = ModelPrice(
        provider="test_provider",
        model="versioned-model",
        input_price_per_1m=1.00,
        output_price_per_1m=2.00,
        effective_from=datetime(2026, 1, 1, tzinfo=UTC),
        currency="USD",
    )
    june_price = ModelPrice(
        provider="test_provider",
        model="versioned-model",
        input_price_per_1m=0.50,
        output_price_per_1m=1.00,
        effective_from=datetime(2026, 6, 1, tzinfo=UTC),
        currency="USD",
    )
    db_session.add_all([jan_price, june_price])
    await db_session.commit()

    # Call on March 15, 2026 (must match Jan price: 10k prompt * 1.0/1e6 = 0.01 + 10k * 2.0/1e6 = 0.02 -> 0.03)
    call_time = datetime(2026, 3, 15, tzinfo=UTC)
    cost8, est8 = await calculate_cost(
        session=db_session,
        model="versioned-model",
        provider="test_provider",
        prompt_tokens=10_000,
        completion_tokens=10_000,
        timestamp=call_time,
    )
    assert est8 is False
    assert cost8 == pytest.approx(0.0300000)

    # 9. Case-insensitive and whitespace-trimmed model name:
    # "  Llama-3.3-70B-Versatile  " with 100,000 prompt tokens -> 100k * 0.59 / 1e6 = 0.059
    cost9, est9 = await calculate_cost(
        session=db_session,
        model="  Llama-3.3-70B-Versatile  ",
        provider="GROQ",
        prompt_tokens=100_000,
        completion_tokens=0,
    )
    assert est9 is False
    assert cost9 == pytest.approx(0.0590000)

    # 10. Unknown model fallback: tokens preserved, cost is 0.0, cost_is_estimated is True
    cost10, est10 = await calculate_cost(
        session=db_session,
        model="unregistered-custom-model-99",
        provider="unknown_provider",
        prompt_tokens=25_000,
        completion_tokens=8_000,
    )
    assert est10 is True
    assert cost10 == 0.0


@pytest.mark.asyncio
async def test_prices_api_crud(client: AsyncClient, db_session: AsyncSession) -> None:
    # 1. Create custom price
    new_price = {
        "provider": "custom_provider",
        "model": "deep-reasoner-v1",
        "input_price_per_1m": 1.25,
        "output_price_per_1m": 3.75,
        "currency": "USD",
    }
    create_res = await client.post("/api/prices", json=new_price)
    assert create_res.status_code == 201
    price_data = create_res.json()
    price_id = price_data["id"]
    assert price_data["model"] == "deep-reasoner-v1"
    assert price_data["input_price_per_1m"] == 1.25

    # 2. List prices and filter by model
    list_res = await client.get("/api/prices", params={"model": "deep-reasoner"})
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    assert items[0]["id"] == price_id

    # 3. Update price
    update_res = await client.put(f"/api/prices/{price_id}", json={"output_price_per_1m": 4.50})
    assert update_res.status_code == 200
    assert update_res.json()["output_price_per_1m"] == 4.50

    # 4. Get by ID
    get_res = await client.get(f"/api/prices/{price_id}")
    assert get_res.status_code == 200
    assert get_res.json()["output_price_per_1m"] == 4.50

    # 5. Delete price
    delete_res = await client.delete(f"/api/prices/{price_id}")
    assert delete_res.status_code == 204

    # 6. Verify 404 after deletion
    not_found_res = await client.get(f"/api/prices/{price_id}")
    assert not_found_res.status_code == 404
