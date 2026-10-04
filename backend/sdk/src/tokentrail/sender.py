import atexit
import logging
import random
import threading
import time
from typing import Any

import httpx

from tokentrail.queue import BoundedSpanQueue
from tokentrail.types import SpanData, TraceData

logger = logging.getLogger("tokentrail.sender")


class BackgroundSender:
    """Dispatches batches of spans from the in-memory queue to the TokenTrail API."""

    def __init__(
        self,
        api_key: str,
        endpoint: str,
        queue: BoundedSpanQueue,
        batch_size: int = 100,
        flush_interval: float = 2.0,
        timeout: float = 5.0,
        max_retries: int = 3,
        base_delay: float = 0.5,
    ) -> None:
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.ingest_url = f"{self.endpoint}/v1/ingest"
        self.queue = queue
        self.batch_size = max(1, batch_size)
        self.flush_interval = max(0.01, flush_interval)
        self.timeout = timeout
        self.max_retries = max(1, max_retries)
        self.base_delay = base_delay

        self._stop_event = threading.Event()
        self._flush_event = threading.Event()
        self._failed_sends_count: int = 0
        self._is_sending = False
        self._lock = threading.Lock()

        # Reusable client
        self._client = httpx.Client(
            headers={
                "X-API-Key": self.api_key,
                "Content-Type": "application/json",
            },
            timeout=self.timeout,
        )

        self._thread = threading.Thread(
            target=self._worker_loop,
            name="tokentrail-sender-worker",
            daemon=True,
        )
        self._thread.start()
        atexit.register(self.shutdown)

    @property
    def failed_sends_count(self) -> int:
        with self._lock:
            return self._failed_sends_count

    @property
    def is_sending(self) -> bool:
        with self._lock:
            return self._is_sending

    def _increment_failed_sends(self) -> None:
        with self._lock:
            self._failed_sends_count += 1

    def _worker_loop(self) -> None:
        last_flush_time = time.monotonic()

        while not self._stop_event.is_set():
            now = time.monotonic()
            elapsed = now - last_flush_time

            wait_time = max(0.005, self.flush_interval - elapsed)
            batch = self.queue.get_batch(self.batch_size, timeout=wait_time)

            if batch:
                with self._lock:
                    self._is_sending = True
                try:
                    self._send_batch_with_retry(batch)
                finally:
                    with self._lock:
                        self._is_sending = False
                last_flush_time = time.monotonic()
            elif elapsed >= self.flush_interval:
                last_flush_time = time.monotonic()

            if self._flush_event.is_set():
                self._drain_all()
                self._flush_event.clear()

    def _send_batch_with_retry(
        self, batch: list[SpanData], trace_meta: list[TraceData] | None = None
    ) -> bool:
        if not batch:
            return True

        payload: dict[str, Any] = {
            "spans": [s.to_dict() for s in batch],
            "traces": [t.to_dict() for t in trace_meta] if trace_meta else [],
        }

        max_delay = 4.0

        for attempt in range(self.max_retries):
            try:
                response = self._client.post(self.ingest_url, json=payload)
                if response.status_code == 200:
                    return True

                if 400 <= response.status_code < 500 and response.status_code != 429:
                    logger.debug(
                        "TokenTrail ingestion rejected batch with status %d: %s",
                        response.status_code,
                        response.text,
                    )
                    self._increment_failed_sends()
                    return False

            except Exception as e:
                logger.debug("TokenTrail network attempt %d failed: %s", attempt + 1, e)

            # Exponential backoff with jitter (only sleep if more attempts remain)
            if attempt < self.max_retries - 1:
                delay = min(max_delay, self.base_delay * (2**attempt)) + random.uniform(0, 0.05)
                time.sleep(delay)

        logger.debug(
            "TokenTrail failed to send batch of %d spans after %d attempts",
            len(batch),
            self.max_retries,
        )
        self._increment_failed_sends()
        return False

    def _drain_all(self) -> None:
        """Drains all remaining spans in the queue."""
        while self.queue.qsize() > 0:
            batch = self.queue.get_batch(self.batch_size, timeout=0.0)
            if not batch:
                break
            with self._lock:
                self._is_sending = True
            try:
                self._send_batch_with_retry(batch)
            finally:
                with self._lock:
                    self._is_sending = False

    def flush(self, timeout: float = 5.0) -> None:
        """Flushes buffered spans synchronously and awaits in-flight transmission."""
        try:
            self._flush_event.set()
            start = time.monotonic()
            while (time.monotonic() - start) < timeout:
                if self.queue.qsize() == 0 and not self.is_sending:
                    break
                time.sleep(0.01)
        except Exception as e:
            logger.debug("TokenTrail flush error: %s", e)

    def shutdown(self, timeout: float = 5.0) -> None:
        """Stops background sender thread and performs final flush."""
        try:
            self._stop_event.set()
            self._drain_all()
            if self._thread.is_alive():
                self._thread.join(timeout=timeout)
            self._client.close()
        except Exception as e:
            logger.debug("TokenTrail shutdown error: %s", e)
