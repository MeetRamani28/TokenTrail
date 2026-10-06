from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient
from tokentrail import TokenTrail
from tokentrail.context import get_current_span_id, get_current_trace_id
from tokentrail.middleware import TokenTrailMiddleware


def test_middleware_request_tracing():
    tt = TokenTrail(api_key="tt_mock_key", endpoint="http://localhost:8000", flush_interval=60.0)
    tt.sender.shutdown()

    recorded = {}

    async def chat_endpoint(request):
        recorded["trace_id"] = get_current_trace_id()
        recorded["parent_id"] = get_current_span_id()

        with tt.span("generate_reply", type="llm") as span:
            recorded["llm_trace_id"] = span.trace_id
            recorded["llm_parent_id"] = span.parent_span_id

        return JSONResponse({"status": "ok"})

    app = Starlette(routes=[Route("/api/chat", chat_endpoint, methods=["POST"])])
    app.add_middleware(TokenTrailMiddleware, client=tt, auto_patch=False)

    client = TestClient(app)
    response = client.post("/api/chat")
    assert response.status_code == 200

    # Verify that the LLM span became a child of the HTTP request root span
    assert recorded["trace_id"] is not None
    assert recorded["llm_trace_id"] == recorded["trace_id"]
    assert recorded["llm_parent_id"] == recorded["parent_id"]
