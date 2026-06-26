"""Reproducible CPU-only feasibility benchmark for documented P0 budgets."""

from __future__ import annotations

import argparse
import json
import platform
import statistics
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from analytics.lineage import CommunityInput, CommunitySnapshot, build_lineage
from apps.api.jobs import DependencyKind, DependencyRef, InMemoryJobRepository, JobSpec
from apps.api.temporal import (
    AssertionClass,
    AssertionRevision,
    HistoricalQuery,
    InMemoryAssertionRepository,
    SourceRecord,
    TemporalInterval,
    TemporalWindowQuery,
)


UTC = timezone.utc
BASE = datetime(2026, 1, 1, tzinfo=UTC)


@dataclass(frozen=True)
class Metric:
    operation: str
    iterations: int
    p50_ms: float
    p95_ms: float
    max_ms: float
    budget_ms: float

    @property
    def passes_budget(self) -> bool:
        return self.p95_ms <= self.budget_ms


def percentile(values: list[float], percentile_value: float) -> float:
    if not values:
        raise ValueError("values must not be empty")
    ordered = sorted(values)
    position = (len(ordered) - 1) * percentile_value
    lower = int(position)
    upper = min(len(ordered) - 1, lower + 1)
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def measure(
    operation: str,
    function: Callable[[], object],
    *,
    iterations: int,
    budget_ms: float,
) -> Metric:
    for _ in range(min(3, iterations)):
        function()
    durations = []
    for _ in range(iterations):
        started = time.perf_counter_ns()
        function()
        durations.append((time.perf_counter_ns() - started) / 1_000_000)
    return Metric(
        operation=operation,
        iterations=iterations,
        p50_ms=round(statistics.median(durations), 3),
        p95_ms=round(percentile(durations, 0.95), 3),
        max_ms=round(max(durations), 3),
        budget_ms=budget_ms,
    )


def synthetic_repository(
    *,
    entity_count: int = 1_000,
    assertion_count: int = 10_000,
    source_count: int = 25,
) -> InMemoryAssertionRepository:
    sources = tuple(
        SourceRecord(
            source_record_id=f"source-{index:03d}",
            source_name=f"Synthetic source {index}",
            original_reference=f"synthetic://source/{index}",
            source_reliability="B",
            information_credibility="2",
            acquired_at=BASE + timedelta(days=index % 12),
            metadata={"synthetic": True},
        )
        for index in range(source_count)
    )
    revisions = []
    for index in range(assertion_count):
        period = index % 12
        valid_start = BASE + timedelta(days=period * 30)
        recorded_start = valid_start + timedelta(days=1 + index % 5)
        revisions.append(
            AssertionRevision(
                assertion_id=f"assertion-{index:05d}",
                revision_id=f"assertion-{index:05d}-r1",
                case_id="benchmark-case",
                subject_ref=f"entity-{index % entity_count:04d}",
                predicate="synthetic_relation",
                object_value=f"entity-{(index * 17 + 3) % entity_count:04d}",
                assertion_class=AssertionClass.PERSISTENT_STATE,
                valid_during=TemporalInterval(valid_start, valid_start + timedelta(days=60)),
                recorded_during=TemporalInterval(recorded_start, None),
                source=sources[index % source_count],
                analytical_confidence=0.5 + (index % 50) / 100,
            )
        )
    return InMemoryAssertionRepository(revisions)


def synthetic_lineage() -> tuple[CommunitySnapshot, ...]:
    snapshots = []
    for period in range(12):
        communities = []
        for community_index in range(50):
            members = {
                f"entity-{(community_index * 20 + offset + period) % 1_000:04d}"
                for offset in range(20)
            }
            communities.append(
                CommunityInput(
                    f"detector-{period}-{community_index}",
                    frozenset(members),
                    confidence=0.8,
                )
            )
        snapshots.append(CommunitySnapshot(f"period-{period:02d}", tuple(communities)))
    return tuple(snapshots)


def correction_impact_fixture() -> tuple[InMemoryJobRepository, DependencyRef]:
    repository = InMemoryJobRepository()
    dependency = DependencyRef(
        DependencyKind.ASSERTION_REVISION,
        "benchmark-corrected-revision",
        "1",
    )
    previous = None
    for index in range(100):
        job = repository.submit(
            JobSpec(
                case_id="benchmark-case",
                kind="benchmark",
                idempotency_key=f"job-{index}",
                input_digest=f"digest-{index}",
            )
        )
        lease = repository.claim(
            worker_id="benchmark-worker",
            lease_for=timedelta(minutes=1),
        )
        assert lease is not None and lease.job_id == job.job_id
        repository.stage_output(
            job.job_id,
            lease.token,
            name="result",
            object_uri=f"memory://result/{index}",
            content_digest=f"digest-{index}",
        )
        dependencies = (
            (dependency,)
            if previous is None
            else (
                DependencyRef(
                    DependencyKind.PUBLICATION,
                    previous.publication_id,
                    str(previous.generation),
                ),
            )
        )
        previous = repository.complete_and_publish(
            job.job_id,
            lease.token,
            result_key=f"benchmark/result/{index}",
            dependencies=dependencies,
            completion_key=f"complete-{index}",
        )
    return repository, dependency


def run_benchmark(*, iterations: int = 20) -> dict[str, object]:
    build_started = time.perf_counter()
    repository = synthetic_repository()
    build_seconds = time.perf_counter() - build_started
    point_query = HistoricalQuery(
        valid_at=BASE + timedelta(days=181),
        known_at=BASE + timedelta(days=365),
        case_id="benchmark-case",
    )
    before = TemporalWindowQuery(
        TemporalInterval(BASE + timedelta(days=120), BASE + timedelta(days=180)),
        BASE + timedelta(days=365),
        "benchmark-case",
    )
    after = TemporalWindowQuery(
        TemporalInterval(BASE + timedelta(days=180), BASE + timedelta(days=240)),
        BASE + timedelta(days=365),
        "benchmark-case",
    )
    lineage_input = synthetic_lineage()
    impact_repository, corrected_dependency = correction_impact_fixture()

    metrics = [
        measure(
            "historical_reconstruction",
            lambda: repository.snapshot(point_query),
            iterations=iterations,
            budget_ms=2_000,
        ),
        measure(
            "two_period_change",
            lambda: (
                set(repository.window_snapshot(before).revision_ids)
                ^ set(repository.window_snapshot(after).revision_ids)
            ),
            iterations=iterations,
            budget_ms=3_000,
        ),
        measure(
            "community_lineage",
            lambda: build_lineage(lineage_input),
            iterations=max(5, iterations // 4),
            budget_ms=10_000,
        ),
        measure(
            "correction_impact_preview",
            lambda: impact_repository.record_correction(
                case_id="benchmark-case",
                correction_id="benchmark-correction",
                dependency=corrected_dependency,
            ),
            iterations=iterations,
            budget_ms=5_000,
        ),
    ]
    return {
        "contract": "CoreCpuBenchmarkV1",
        "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "environment": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "processor": platform.processor(),
            "cpu_count": __import__("os").cpu_count(),
        },
        "fixture": {
            "entities": 1_000,
            "assertions": 10_000,
            "periods": 12,
            "sources": 25,
            "repository_build_seconds": round(build_seconds, 3),
        },
        "metrics": [
            {**asdict(metric), "passes_budget": metric.passes_budget}
            for metric in metrics
        ],
        "all_measured_budgets_pass": all(metric.passes_budget for metric in metrics),
        "limitations": [
            "Synthetic deterministic fixture; not an operational-scale claim.",
            "In-memory reference paths exclude network and durable-storage latency.",
            "UI rendering and report generation require separate browser/service benchmarks.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=20)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.iterations < 1:
        parser.error("--iterations must be positive")
    result = run_benchmark(iterations=args.iterations)
    payload = json.dumps(result, indent=2, sort_keys=True)
    print(payload)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
    return 0 if result["all_measured_budgets_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
