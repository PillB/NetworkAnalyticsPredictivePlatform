# ADR 0002: Modular Monolith and Separate Analytics Worker

## Status

Accepted for P0.

## Decision

Implement one FastAPI application with enforced domain modules and one separate Python analytics worker. Use PostgreSQL-backed durable jobs with staged, atomic result publication.

## Rationale

Evidence revision, dependencies, audit, authorization, and publication require cohesive transactions. Network-distributed services add failure modes without current scaling evidence.

## Alternatives

- Microservices: deferred until independently scaling teams or workloads exist.
- Celery/Redis/Kafka: deferred until PostgreSQL jobs fail concurrency or scheduling requirements.

## Traceability

REQ-NFR-004, 010; REQ-FR-019; GATE-I, K.
