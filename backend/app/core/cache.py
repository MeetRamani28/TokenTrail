"""In-memory cache management with maximum capacity caps.

Prevents unbounded memory growth and RAM exhaustion on memory-constrained
environments like Render 512MB free instances.
"""

import threading
from collections import OrderedDict
from collections.abc import Callable
from functools import wraps
from typing import Any


class BoundedCache[K, V]:
    """Thread-safe bounded in-memory dictionary cache with LRU eviction.

    Ensures the cache size never exceeds max_size (default: 500).
    When capacity is reached, the oldest entries are evicted.
    """

    def __init__(self, max_size: int = 500) -> None:
        self.max_size = max(1, max_size)
        self._data: OrderedDict[K, V] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: K, default: V | None = None) -> V | None:
        with self._lock:
            if key not in self._data:
                return default
            self._data.move_to_end(key)
            return self._data[key]

    def set(self, key: K, value: V) -> None:
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
            self._data[key] = value
            # Enforce max size cap (e.g. popping oldest when items > max_size)
            while len(self._data) > self.max_size:
                self._data.popitem(last=False)

    def __getitem__(self, key: K) -> V:
        with self._lock:
            self._data.move_to_end(key)
            return self._data[key]

    def __setitem__(self, key: K, value: V) -> None:
        self.set(key, value)

    def __contains__(self, key: object) -> bool:
        with self._lock:
            return key in self._data

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)

    def pop(self, key: K, default: Any = None) -> Any:
        with self._lock:
            return self._data.pop(key, default)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def keys(self) -> list[K]:
        with self._lock:
            return list(self._data.keys())

    def values(self) -> list[V]:
        with self._lock:
            return list(self._data.values())

    def items(self) -> list[tuple[K, V]]:
        with self._lock:
            return list(self._data.items())


def bounded_lru_cache(max_size: int = 500) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator for caching function results with a hard memory cap of max_size items."""
    cache: BoundedCache[Any, Any] = BoundedCache(max_size=max_size)

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = (args, tuple(sorted(kwargs.items())))
            cached_val = cache.get(key)
            if cached_val is not None:
                return cached_val
            result = fn(*args, **kwargs)
            cache.set(key, result)
            return result

        wrapper.cache_clear = cache.clear  # type: ignore[attr-defined]
        return wrapper

    return decorator


# Global in-memory capped caches (max 500 items per cache)
response_cache: BoundedCache[str, Any] = BoundedCache(max_size=500)
rag_schema_cache: BoundedCache[str, Any] = BoundedCache(max_size=500)
schema_cache: BoundedCache[str, Any] = BoundedCache(max_size=500)
price_cache: BoundedCache[str, Any] = BoundedCache(max_size=500)
query_cache: BoundedCache[str, Any] = BoundedCache(max_size=500)
