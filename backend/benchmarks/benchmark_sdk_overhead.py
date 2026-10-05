"""Benchmark SDK Overhead

Measures the per-span overhead of the TokenTrail Python SDK compared to a
baseline function execution without tracing.

Saves raw results to backend/benchmarks/raw/sdk_overhead.json.
"""

import json
import math
import platform
import sys
import time
from pathlib import Path

# Add SDK path to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
SDK_DIR = BACKEND_DIR / "sdk" / "src"
if str(SDK_DIR) not in sys.path:
    sys.path.insert(0, str(SDK_DIR))

from tokentrail import TokenTrail


def calculate_percentile(data: list[float], p: float) -> float:
    sorted_d = sorted(data)
    idx = (len(sorted_d) - 1) * (p / 100.0)
    floor_idx = math.floor(idx)
    ceil_idx = math.ceil(idx)
    if floor_idx == ceil_idx:
        return sorted_d[int(idx)]
    d0 = sorted_d[int(floor_idx)] * (ceil_idx - idx)
    d1 = sorted_d[int(ceil_idx)] * (idx - floor_idx)
    return d0 + d1


def baseline_function(x: int) -> int:
    return x * 2 + 1


def main() -> None:
    print("==================================================")
    print(" TokenTrail SDK Overhead Benchmark")
    print("==================================================")

    iterations = 2000
    tt = TokenTrail(
        api_key="tt_live_benchmark_key",
        endpoint="http://127.0.0.1:8000",
        batch_size=500,
        flush_interval=100.0,  # Do not flush during loop
    )

    # 1. Warmup
    for i in range(100):
        baseline_function(i)
        with tt.span("warmup", type="llm"):
            baseline_function(i)

    # 2. Measure baseline without SDK
    baseline_latencies_ms: list[float] = []
    for i in range(iterations):
        t0 = time.perf_counter()
        _ = baseline_function(i)
        t1 = time.perf_counter()
        baseline_latencies_ms.append((t1 - t0) * 1000.0)

    # 3. Measure with TokenTrail SDK span
    sdk_latencies_ms: list[float] = []
    for i in range(iterations):
        t0 = time.perf_counter()
        with tt.span("bench_span", type="llm"):
            _ = baseline_function(i)
        t1 = time.perf_counter()
        sdk_latencies_ms.append((t1 - t0) * 1000.0)

    # Shutdown SDK sender without throwing
    tt.shutdown(timeout=1.0)

    # Calculate metrics
    base_p50 = calculate_percentile(baseline_latencies_ms, 50.0)
    base_p99 = calculate_percentile(baseline_latencies_ms, 99.0)

    sdk_p50 = calculate_percentile(sdk_latencies_ms, 50.0)
    sdk_p99 = calculate_percentile(sdk_latencies_ms, 99.0)

    overhead_p50 = max(0.0, sdk_p50 - base_p50)
    overhead_p99 = max(0.0, sdk_p99 - base_p99)

    print(f"Iterations:        {iterations}")
    print(f"Baseline (p50):    {base_p50 * 1000.0:.2f} µs")
    print(f"Baseline (p99):    {base_p99 * 1000.0:.2f} µs")
    print(f"With SDK (p50):    {sdk_p50 * 1000.0:.2f} µs")
    print(f"With SDK (p99):    {sdk_p99 * 1000.0:.2f} µs")
    print("--------------------------------------------------")
    print(
        f"SDK Overhead (p50): {overhead_p50:.4f} ms ({overhead_p50 * 1000.0:.1f} µs) [Target: < 0.5 ms]"
    )
    print(
        f"SDK Overhead (p99): {overhead_p99:.4f} ms ({overhead_p99 * 1000.0:.1f} µs) [Target: < 2.0 ms]"
    )
    print("==================================================")

    # Save raw outputs
    raw_dir = BACKEND_DIR / "benchmarks" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_file = raw_dir / "sdk_overhead.json"

    data = {
        "timestamp": time.time(),
        "iterations": iterations,
        "platform": platform.platform(),
        "python_version": sys.version,
        "baseline_p50_ms": round(base_p50, 6),
        "baseline_p99_ms": round(base_p99, 6),
        "with_sdk_p50_ms": round(sdk_p50, 6),
        "with_sdk_p99_ms": round(sdk_p99, 6),
        "overhead_p50_ms": round(overhead_p50, 6),
        "overhead_p99_ms": round(overhead_p99, 6),
        "target_p50_ms": 0.5,
        "target_p99_ms": 2.0,
        "status": "PASS" if overhead_p50 < 0.5 and overhead_p99 < 2.0 else "FAIL",
    }
    with open(raw_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Raw results written to: {raw_file}")


if __name__ == "__main__":
    main()
