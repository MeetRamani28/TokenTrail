from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_and_create_projects(client: AsyncClient, test_setup: dict[str, Any]) -> None:
    headers = {"Authorization": "Bearer test_token"}

    # 1. List existing projects
    resp = await client.get("/api/projects", headers=headers)
    assert resp.status_code == 200
    projects = resp.json()
    assert len(projects) >= 1
    assert any(p["id"] == test_setup["project"].id for p in projects)

    # 2. Create a new project
    create_payload = {"name": "Nexus RAG Project", "retention_days": 60}
    resp = await client.post("/api/projects", json=create_payload, headers=headers)
    assert resp.status_code == 201
    new_proj = resp.json()
    assert new_proj["name"] == "Nexus RAG Project"
    assert new_proj["retention_days"] == 60
    assert new_proj["api_key"].startswith("tt_live_")
    assert new_proj["key_prefix"].startswith("tt_live_")

    # 3. Verify it shows up in list_projects
    resp = await client.get("/api/projects", headers=headers)
    assert resp.status_code == 200
    updated_projects = resp.json()
    assert any(p["name"] == "Nexus RAG Project" for p in updated_projects)

    # 4. Get key for the newly created project
    resp = await client.get(f"/api/projects/{new_proj['id']}/key", headers=headers)
    assert resp.status_code == 200
    key_data = resp.json()
    assert key_data["project_name"] == "Nexus RAG Project"
    assert key_data["key_prefix"].startswith("tt_live_")
