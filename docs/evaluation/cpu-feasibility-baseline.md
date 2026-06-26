# CPU Feasibility Baseline

Date: 2026-06-25  
Contract: `CoreCpuBenchmarkV1`  
Command: `make benchmark`

## Environment

- Python 3.11.15
- macOS x86_64
- 8 logical CPUs
- no GPU

## Synthetic reference tier

- 1,000 entities;
- 10,000 assertions;
- 12 periods;
- 25 sources.

## Measured results

| Operation | Iterations | P50 | P95 | Budget | Result |
|---|---:|---:|---:|---:|---|
| Historical reconstruction | 20 | 7.793 ms | 8.258 ms | 2,000 ms | Pass |
| Two-period change | 20 | 15.717 ms | 21.852 ms | 3,000 ms | Pass |
| Community lineage | 5 | 286.657 ms | 324.037 ms | 10,000 ms | Pass |
| Correction impact preview | 20 | 0.007 ms | 0.008 ms | 5,000 ms | Pass |

The machine-readable result is generated at
`test-results/benchmarks/core-cpu.json`.

## Interpretation

These results demonstrate CPU feasibility for the deterministic reference
implementations at the documented fixture tier. They are not production,
market-scale, or end-to-end latency claims.

The temporal and correction measurements are in-memory and exclude network,
PostgreSQL, object storage, authorization, serialization, and contention.
Community lineage measures matching over planted snapshots, not community
detection itself. Browser rendering, API throughput, report generation, and
durable-job execution require separate benchmarks.

## Reviewer question: what could make this wrong?

- Synthetic topology may be materially easier than operational graphs.
- Five lineage iterations are enough for a feasibility observation but not a
  stable capacity claim.
- No cold-cache, memory-pressure, concurrent-user, or fault-injection run is
  included.
- Passing wide provisional budgets does not prove analyst value.

The next benchmark increment must measure PostgreSQL-backed reconstruction,
authorized projection, provenance reverse lookup, worker publication, browser
interaction P95, and report generation.
