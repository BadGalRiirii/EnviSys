"""ASGI entrypoint: HTTP (Django) + WebSockets (Channels).

WebSocket routes:
- /ws/notifications/          → per-user live notification push
- /ws/groups/<group_id>/      → live discussion thread for a thesis group
Clients authenticate by appending ?token=<JWT access token>.
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "envisys_backend.settings")
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from apps.collaboration.middleware import JWTAuthMiddleware  # noqa: E402
from apps.collaboration.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
