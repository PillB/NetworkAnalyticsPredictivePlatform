from __future__ import annotations

import unittest

from apps.api import optional_api


class OptionalApiTests(unittest.TestCase):
    def test_module_imports_without_requiring_fastapi(self) -> None:
        self.assertIsInstance(optional_api.fastapi_available(), bool)
        if optional_api.fastapi_available():
            self.assertIsNotNone(optional_api.app)
        else:
            self.assertIsNone(optional_api.app)
            with self.assertRaises(RuntimeError):
                optional_api.create_app()


if __name__ == "__main__":
    unittest.main()
