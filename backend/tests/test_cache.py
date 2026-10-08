from app.core.cache import (
    BoundedCache,
    bounded_lru_cache,
    price_cache,
    rag_schema_cache,
    response_cache,
    schema_cache,
)


def test_bounded_cache_max_size_cap() -> None:
    cache: BoundedCache[str, int] = BoundedCache(max_size=3)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)
    assert len(cache) == 3
    assert cache.get("a") == 1

    # Adding 4th item should evict oldest accessed
    cache.set("d", 4)
    assert len(cache) == 3
    # 'b' should be evicted because 'a' was accessed via get
    assert "b" not in cache
    assert cache.get("a") == 1
    assert cache.get("c") == 3
    assert cache.get("d") == 4


def test_bounded_cache_500_cap() -> None:
    cache: BoundedCache[str, str] = BoundedCache(max_size=500)
    for i in range(700):
        cache.set(f"key_{i}", f"val_{i}")

    # Maximum items must never exceed 500
    assert len(cache) == 500
    # Earliest items (0 to 199) must have been evicted
    assert "key_0" not in cache
    assert "key_199" not in cache
    # Latest items (200 to 699) must be retained
    assert "key_200" in cache
    assert "key_699" in cache


def test_bounded_cache_operations() -> None:
    cache: BoundedCache[str, int] = BoundedCache(max_size=10)
    cache["k1"] = 100
    assert cache["k1"] == 100
    assert "k1" in cache
    assert cache.get("k1") == 100
    assert cache.get("k2", 999) == 999

    assert cache.pop("k1") == 100
    assert len(cache) == 0

    cache.set("x", 1)
    cache.set("y", 2)
    assert set(cache.keys()) == {"x", "y"}
    assert set(cache.values()) == {1, 2}
    cache.clear()
    assert len(cache) == 0


def test_bounded_lru_cache_decorator() -> None:
    call_count = 0

    @bounded_lru_cache(max_size=2)
    def compute(x: int) -> int:
        nonlocal call_count
        call_count += 1
        return x * 10

    assert compute(2) == 20
    assert call_count == 1
    # Cache hit
    assert compute(2) == 20
    assert call_count == 1

    assert compute(3) == 30
    assert compute(4) == 40
    assert call_count == 3
    # compute(2) should have been evicted
    assert compute(2) == 20
    assert call_count == 4


def test_global_caches_exist_with_cap() -> None:
    for c in (response_cache, rag_schema_cache, schema_cache, price_cache):
        assert c.max_size == 500
        assert len(c) <= 500
