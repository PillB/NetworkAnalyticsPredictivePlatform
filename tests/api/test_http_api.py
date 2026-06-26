from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from apps.api.optional_api import create_app


class HttpApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(create_app())
        cls.headers = {
            "X-Actor-Id": "api-test-analyst",
            "X-Purpose": "training",
            "X-Authorization-Id": "api-test-grant",
            "X-Allowed-Fields": "device_signature,precise_location",
        }

    def test_workbench_endpoint_returns_authorized_service_contract(self) -> None:
        response = self.client.get(
            "/v1/cases/harbor-lantern/workbench",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["contract"], "WorkbenchBootstrapV1")
        self.assertEqual(len(payload["relationships"]), 6)
        self.assertEqual(len(payload["prioritization"]), 7)
        self.assertEqual(
            payload["authorization_digest"],
            payload["after_projection"]["authorization_digest"],
        )

    def test_missing_authorization_headers_fail_closed(self) -> None:
        response = self.client.get("/v1/cases/harbor-lantern/workbench")

        self.assertEqual(response.status_code, 422)

    def test_invalid_purpose_returns_structured_denial(self) -> None:
        response = self.client.get(
            "/v1/cases/harbor-lantern/workbench",
            headers={**self.headers, "X-Purpose": "unapproved"},
        )

        self.assertEqual(response.status_code, 403)
        detail = response.json()["detail"]
        self.assertEqual(detail["contract"], "StructuredErrorV1")
        self.assertEqual(detail["error"]["code"], "purpose_denied")

    def test_field_restrictions_are_applied_before_response_topology(self) -> None:
        response = self.client.get(
            "/v1/cases/harbor-lantern/workbench",
            headers={**self.headers, "X-Allowed-Fields": ""},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(
            {relationship["id"] for relationship in payload["relationships"]},
            {"r1", "r2", "r3", "r4"},
        )
        self.assertEqual(payload["excluded_relationship_count"], 2)
        self.assertEqual(len(payload["prioritization"]), 5)

    def test_static_application_is_served_by_the_api_runtime(self) -> None:
        root = self.client.get("/", follow_redirects=False)
        page = self.client.get("/apps/web/")
        module = self.client.get("/packages/guided-workflow/harbor-lantern.mjs")

        self.assertEqual(root.status_code, 307)
        self.assertEqual(root.headers["location"], "/apps/web/")
        self.assertEqual(page.status_code, 200)
        self.assertIn("text/html", page.headers["content-type"])
        self.assertEqual(module.status_code, 200)
        self.assertIn("text/javascript", module.headers["content-type"])


if __name__ == "__main__":
    unittest.main()
