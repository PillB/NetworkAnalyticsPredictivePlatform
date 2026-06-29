.PHONY: setup test test-all test-python test-web test-browser test-browser-api test-browser-accessibility test-browser-pages test-browser-postgres-required test-postgres-live benchmark pages-build pages-preview demo api

PYTHON := .venv/bin/python

test: test-python test-web

setup:
	UV_CACHE_DIR=/tmp/network-analytics-uv-cache uv sync --python 3.11

test-all: test test-browser test-browser-api test-browser-accessibility test-browser-pages test-browser-postgres-required test-postgres-live

test-python:
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s tests/backend -p 'test_*.py' -v
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s tests/analytics -p 'test_*.py' -v
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s tests/api -p 'test_*.py' -v
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s tests/database -p 'test_*.py' -v
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s tests/jobs -p 'test_*.py' -v
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s tests/prioritization -p 'test_*.py' -v
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s tests/benchmarks -p 'test_*.py' -v
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s tests/persistence -t . -p 'test_*.py' -v
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s tests/security -p 'test_*.py' -v
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest discover -s tests/storage -p 'test_*.py' -v

test-web:
	node --test tests/frontend/*.test.mjs

test-browser:
	node tests/browser/playwright.e2e.mjs

test-browser-api:
	PLAYWRIGHT_SERVER=api node tests/browser/playwright.e2e.mjs

test-browser-accessibility:
	node tests/browser/accessibility.e2e.mjs

test-browser-pages:
	node tests/browser/pages.e2e.mjs

test-browser-postgres-required:
	node tests/browser/postgres-required.e2e.mjs

test-postgres-live:
	.venv/bin/python tests/database/live_postgres_integration.py

benchmark:
	.venv/bin/python benchmarks/core_cpu.py --output test-results/benchmarks/core-cpu.json

pages-build:
	node scripts/build-pages.mjs

pages-preview: pages-build
	node scripts/serve-pages.mjs

demo:
	node scripts/serve-web.mjs

api:
	.venv/bin/uvicorn apps.api.optional_api:app --host 127.0.0.1 --port 4173
