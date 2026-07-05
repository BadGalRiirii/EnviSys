"""Stored Google OAuth credentials per user (server-side integration).

token/refresh_token are encrypted at rest (Fernet) — the DB stores only
ciphertext; the plain values are only ever held in memory via the
token/refresh_token properties below.
"""
from django.conf import settings
from django.db import models


def _cipher():
    from cryptography.fernet import Fernet

    return Fernet(settings.FIELD_ENCRYPTION_KEY)


def _encrypt(value: str) -> str:
    return _cipher().encrypt(value.encode()).decode() if value else ""


def _decrypt(value: str) -> str:
    return _cipher().decrypt(value.encode()).decode() if value else ""


class GoogleCredential(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="google_credential"
    )
    token_encrypted = models.TextField(blank=True)
    refresh_token_encrypted = models.TextField(blank=True)
    token_expiry = models.DateTimeField(null=True, blank=True)
    google_email = models.EmailField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def token(self) -> str:
        return _decrypt(self.token_encrypted)

    @token.setter
    def token(self, value: str) -> None:
        self.token_encrypted = _encrypt(value)

    @property
    def refresh_token(self) -> str:
        return _decrypt(self.refresh_token_encrypted)

    @refresh_token.setter
    def refresh_token(self, value: str) -> None:
        self.refresh_token_encrypted = _encrypt(value)

    def __str__(self):
        return f"Google credential for {self.user}"
