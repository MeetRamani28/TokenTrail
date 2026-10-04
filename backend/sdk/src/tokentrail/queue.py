import threading
from collections import deque

from tokentrail.types import DropPolicy, SpanData


class BoundedSpanQueue:
    """Thread-safe bounded queue for buffering spans prior to background ingestion."""

    def __init__(self, max_size: int = 10_000, drop_policy: DropPolicy = "drop_oldest") -> None:
        self.max_size = max(1, max_size)
        self.drop_policy: DropPolicy = drop_policy
        self._deque: deque[SpanData] = deque()
        self._lock = threading.Lock()
        self._condition = threading.Condition(self._lock)
        self._dropped_count: int = 0

    def put(self, item: SpanData) -> bool:
        """Pushes a span into the queue.

        If the queue is full, either the oldest item is discarded or the incoming
        item is dropped according to drop_policy, and dropped_count is incremented.
        """
        with self._condition:
            if len(self._deque) >= self.max_size:
                self._dropped_count += 1
                if self.drop_policy == "drop_oldest":
                    self._deque.popleft()
                    self._deque.append(item)
                    self._condition.notify()
                    return True
                else:
                    # drop_newest: ignore incoming item
                    return False

            self._deque.append(item)
            self._condition.notify()
            return True

    def get_batch(self, max_items: int, timeout: float = 0.5) -> list[SpanData]:
        """Retrieves up to max_items from the queue, waiting up to timeout seconds."""
        with self._condition:
            if not self._deque and timeout > 0:
                self._condition.wait(timeout)

            batch: list[SpanData] = []
            while self._deque and len(batch) < max_items:
                batch.append(self._deque.popleft())
            return batch

    def qsize(self) -> int:
        with self._lock:
            return len(self._deque)

    @property
    def dropped_count(self) -> int:
        with self._lock:
            return self._dropped_count
