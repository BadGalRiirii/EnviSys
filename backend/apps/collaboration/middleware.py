"""JWT authentication for WebSocket connections (?token=<access token>)."""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def get_user(token: str):
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import AccessToken

    try:
        user_id = AccessToken(token)["user_id"]
        return get_user_model().objects.get(pk=user_id)
    except Exception:  # noqa: BLE001 — any failure means anonymous
        return AnonymousUser()


class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        token = (query.get("token") or [""])[0]
        scope["user"] = await get_user(token) if token else AnonymousUser()
        return await self.inner(scope, receive, send)
