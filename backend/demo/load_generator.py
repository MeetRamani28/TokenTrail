"""TokenTrail Synthetic Telemetry Traffic Generator.

Generates realistic traces and hierarchical spans to seed or stress-test
the TokenTrail ingestion and analytics engines.
"""

import argparse
import os
import random
import sys
import time
from pathlib import Path

# Ensure SDK is on sys.path when running standalone
sdk_src = Path(__file__).resolve().parent.parent / "sdk" / "src"
if sdk_src.exists() and str(sdk_src) not in sys.path:
    sys.path.insert(0, str(sdk_src))

from tokentrail import TokenTrail  # noqa: E402

MODELS = [
    ("llama-3.3-70b-versatile", "groq", 100, 350, 45, 120),
    ("mixtral-8x7b-32768", "groq", 250, 800, 30, 95),
    ("gemma2-9b-it", "groq", 50, 150, 20, 60),
]

FLOW_NAMES = [
    "customer_support_flow",
    "financial_report_summarizer",
    "code_generation_assistant",
    "rag_knowledge_search",
    "document_qa_pipeline",
]

TAGS_POOL = ["prod", "agent", "rag", "support", "billing", "v1.2", "external_api"]


def generate_trace_payload(tt: TokenTrail, error_rate: float) -> None:
    flow = random.choice(FLOW_NAMES)
    model, provider, min_tokens, max_tokens, min_ttft, max_ttft = random.choice(MODELS)
    has_error = random.random() < error_rate
    tags = random.sample(TAGS_POOL, k=random.randint(1, 3))
    user_id = f"user_{random.randint(100, 999)}"
    session_id = f"sess_{random.randint(1000, 9999)}"

    # Top-level span
    with tt.span(flow, type="chain") as root_span:
        root_span.metadata = {"user_id": user_id, "session_id": session_id, "tags": tags}

        # Step 1: Retrieval
        with tt.span("vector_retrieval", type="retrieval") as s_ret:
            s_ret.input = "semantic vector query"
            s_ret.duration_ms = random.uniform(25.0, 95.0)
            s_ret.output = f"Top {random.randint(2, 5)} documents retrieved"

        # Step 2: Tool execution
        if random.random() > 0.4:
            with tt.span("data_filter_tool", type="tool") as s_tool:
                s_tool.input = "Context compression"
                s_tool.duration_ms = random.uniform(10.0, 40.0)
                s_tool.output = "Context trimmed by 40%"

        # Step 3: LLM Call
        with tt.span("chat_completion", type="llm") as s_llm:
            prompt_toks = random.randint(min_tokens, max_tokens)
            comp_toks = random.randint(min_tokens // 2, max_tokens // 2)
            ttft = random.uniform(min_ttft, max_ttft)
            dur = ttft + random.uniform(80.0, 450.0)

            s_llm.model = model
            s_llm.provider = provider
            s_llm.prompt_tokens = prompt_toks
            s_llm.completion_tokens = comp_toks
            s_llm.ttft_ms = ttft
            s_llm.duration_ms = dur
            s_llm.input = "User query prompt"
            s_llm.output = "Generated assistant completion"

            if has_error:
                s_llm.status = "error"
                s_llm.error_type = random.choice(
                    ["RateLimitError", "APIConnectionError", "ModelTimeoutError"]
                )
                s_llm.error_message = f"Simulated {s_llm.error_type}: Provider returned 429 or 504"
                root_span.status = "error"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic LLM traces for TokenTrail")
    parser.add_argument("--count", type=int, default=50, help="Total number of traces to generate")
    parser.add_argument("--rps", type=float, default=10.0, help="Requests per second rate")
    parser.add_argument(
        "--error-rate", type=float, default=0.15, help="Fraction of error traces (0.0 - 1.0)"
    )
    parser.add_argument(
        "--endpoint", type=str, default=os.getenv("TOKENTRAIL_ENDPOINT", "http://127.0.0.1:8000")
    )
    parser.add_argument(
        "--api-key", type=str, default=os.getenv("TOKENTRAIL_API_KEY", "tt_live_dev_test_key")
    )

    args = parser.parse_args()

    print("==================================================")
    print(" TokenTrail Synthetic Traffic Load Generator")
    print(f" Target Endpoint: {args.endpoint}")
    print(
        f" Generating {args.count} traces at ~{args.rps} req/sec (Error Rate: {args.error_rate * 100:.1f}%)"
    )
    print("==================================================")

    tt = TokenTrail(api_key=args.api_key, endpoint=args.endpoint, flush_interval=1.0)
    delay_between_requests = 1.0 / max(0.1, args.rps)

    start = time.perf_counter()
    for i in range(1, args.count + 1):
        generate_trace_payload(tt, args.error_rate)
        if i % 10 == 0 or i == args.count:
            print(f" -> Dispatched {i}/{args.count} traces...")
        time.sleep(delay_between_requests)

    elapsed = time.perf_counter() - start
    print(
        f"\n[LoadGen] Generated {args.count} traces in {elapsed:.2f}s (~{args.count / elapsed:.1f} rps)"
    )
    print("[LoadGen] Flushing remaining telemetry...")
    tt.flush(timeout=10.0)
    print("[LoadGen] Telemetry generation complete!")


if __name__ == "__main__":
    main()
