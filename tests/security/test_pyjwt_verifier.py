from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from apps.api.security import (
    IdentityVerificationError,
    OIDCRequirements,
    PyJWKIdentityVerifier,
)


UTC = timezone.utc
NOW = datetime.now(UTC).replace(microsecond=0)
ISSUER = "https://issuer.example.test"
AUDIENCE = "network-api"
NONCE = "nonce-7"


def payload(**overrides):
    value = {
        "iss": ISSUER,
        "sub": "subject-7",
        "aud": AUDIENCE,
        "exp": int((NOW + timedelta(minutes=10)).timestamp()),
        "iat": int((NOW - timedelta(seconds=10)).timestamp()),
        "nonce": NONCE,
        "acr": "urn:example:loa:2",
        "jti": "token-7",
    }
    value.update(overrides)
    return value


class StaticJWKClient:
    def __init__(self, public_key) -> None:
        self.public_key = public_key

    def get_signing_key_from_jwt(self, credential: str):
        return SimpleNamespace(key=self.public_key, key_id="key-7")


class PyJWKIdentityVerifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048
        )
        cls.public_key = cls.private_key.public_key()
        cls.requirements = OIDCRequirements(
            issuer=ISSUER,
            audience=AUDIENCE,
            minimum_acr="urn:example:loa:2",
        )

    def verifier(self) -> PyJWKIdentityVerifier:
        with patch("jwt.PyJWKClient", return_value=StaticJWKClient(self.public_key)):
            return PyJWKIdentityVerifier("https://issuer.example.test/jwks")

    def token(self, **overrides) -> str:
        return jwt.encode(
            payload(**overrides),
            self.private_key,
            algorithm="RS256",
            headers={"kid": "key-7"},
        )

    def verify(self, token: str):
        return self.verifier().verify(
            token,
            requirements=self.requirements,
            expected_nonce=NONCE,
            now=NOW,
        )

    def test_verifies_signed_claims_and_returns_narrow_contract(self) -> None:
        claims = self.verify(self.token())

        self.assertEqual("subject-7", claims.subject)
        self.assertEqual((AUDIENCE,), claims.audiences)
        self.assertEqual("pyjwt:jwks:key-7", claims.verification_method)

    def test_rejects_nonce_acr_issuer_and_audience_mismatch(self) -> None:
        invalid = (
            self.token(nonce="wrong"),
            self.token(acr="urn:example:loa:1"),
            self.token(iss="https://attacker.example"),
            self.token(aud="different-api"),
        )
        for token in invalid:
            with self.subTest(token=token[-12:]):
                with self.assertRaises(IdentityVerificationError):
                    self.verify(token)

    def test_multi_audience_requires_matching_authorized_party(self) -> None:
        with self.assertRaises(IdentityVerificationError):
            self.verify(self.token(aud=[AUDIENCE, "other-api"]))

        claims = self.verify(
            self.token(aud=[AUDIENCE, "other-api"], azp=AUDIENCE)
        )
        self.assertEqual((AUDIENCE, "other-api"), claims.audiences)

    def test_missing_required_claim_and_wrong_signature_fail_closed(self) -> None:
        missing = payload()
        missing.pop("jti")
        token = jwt.encode(missing, self.private_key, algorithm="RS256")
        with self.assertRaises(IdentityVerificationError):
            self.verify(token)

        attacker = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        with self.assertRaises(IdentityVerificationError):
            self.verify(jwt.encode(payload(), attacker, algorithm="RS256"))

    def test_configuration_rejects_insecure_algorithms_and_non_https_jwks(self) -> None:
        with self.assertRaises(ValueError):
            PyJWKIdentityVerifier("http://issuer.example.test/jwks")
        with self.assertRaises(ValueError):
            PyJWKIdentityVerifier(
                "https://issuer.example.test/jwks", algorithms=("none",)
            )
        with self.assertRaises(ValueError):
            PyJWKIdentityVerifier(
                "https://issuer.example.test/jwks", algorithms=("HS256",)
            )


if __name__ == "__main__":
    unittest.main()
