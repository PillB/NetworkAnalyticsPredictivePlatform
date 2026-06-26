from __future__ import annotations

import unittest

from benchmarks.core_cpu import percentile, run_benchmark


class CoreCpuBenchmarkTests(unittest.TestCase):
    def test_percentile_interpolates_deterministically(self) -> None:
        self.assertEqual(percentile([1.0, 2.0, 3.0], 0.5), 2.0)
        self.assertAlmostEqual(percentile([1.0, 2.0], 0.95), 1.95)

    def test_smoke_benchmark_has_versioned_evidence(self) -> None:
        result = run_benchmark(iterations=1)

        self.assertEqual(result["contract"], "CoreCpuBenchmarkV1")
        self.assertEqual(result["fixture"]["entities"], 1_000)
        self.assertEqual(result["fixture"]["assertions"], 10_000)
        self.assertEqual(
            {metric["operation"] for metric in result["metrics"]},
            {
                "historical_reconstruction",
                "two_period_change",
                "community_lineage",
                "correction_impact_preview",
            },
        )


if __name__ == "__main__":
    unittest.main()
