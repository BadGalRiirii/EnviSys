"""Root URL configuration for the EnviSys API."""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    return JsonResponse({"status": "ok", "service": "EnviSys API"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/groups/", include("apps.groups.urls")),
    path("api/theses/", include("apps.theses.urls")),
    path("api/documents/", include("apps.documents.urls")),
    path("api/defenses/", include("apps.defenses.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/audit/", include("apps.audit.urls")),
    path("api/integrations/", include("apps.integrations.urls")),
    path("api/collaboration/", include("apps.collaboration.urls")),
    path("api/reports/", include("apps.reports.urls")),
]
