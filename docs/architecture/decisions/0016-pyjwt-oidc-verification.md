# ADR 0016: PyJWT OIDC ID-Token Verification

## Status

Accepted.

## Decision

Production-configurable ID-token verification uses PyJWT 2.x with its
cryptography dependency and `PyJWKClient`. The verifier receives one trusted
HTTPS JWKS URL and a fixed asymmetric algorithm allowlist. It rejects `none`,
HMAC algorithms, non-HTTPS key endpoints, missing credentials, and ambiguous
configuration.

Before emitting `VerifiedIdentityClaims`, the verifier requires and validates
signature, issuer, audience, expiry, issue time, subject, nonce,
authentication-context (`acr`), and token identifier (`jti`). It independently
checks nonce and assurance against the authorization request. Multi-audience
tokens require `azp` equal to the configured application audience; a supplied
single-audience `azp` must also match.

Only the narrow verified-claims contract crosses into actor mapping, replay
protection, grants, and policy evaluation. Raw credentials are not logged or
persisted.

## Rationale

PyJWT provides explicit algorithm allowlists, registered-claim validation, and
JWKS key selection without coupling the domain boundary to a provider SDK.
Independent nonce, assurance, and authorized-party checks preserve the OIDC
application semantics that generic JWT signature validation alone does not
establish.

## Consequences

- Deployment must obtain issuer metadata and the trusted JWKS URL through
  controlled configuration.
- TLS, outbound network policy, issuer key rotation, JWKS availability,
  callback state/PKCE, secure cookies, logout, and session lifecycle remain
  transport/deployment responsibilities.
- The default algorithm is RS256. Additional asymmetric algorithms require an
  explicit configuration and interoperability test.
- Verification failures expose a generic boundary error; credentials and
  claim payloads are excluded from diagnostics.

## Primary references

- [PyJWT usage and JWKS verification](https://pyjwt.readthedocs.io/en/stable/usage.html)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)

## Verification

`tests/security/test_pyjwt_verifier.py` signs test tokens with an ephemeral RSA
key and verifies valid claims, issuer/audience/nonce/ACR failures,
multi-audience `azp`, required claims, wrong signatures, and insecure
configuration rejection.
