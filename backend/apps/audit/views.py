from rest_framework import viewsets

from apps.accounts.permissions import IsAdmin

from .models import ActivityLog
from .serializers import ActivityLogSerializer


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-only view of system activity for monitoring and accountability."""

    serializer_class = ActivityLogSerializer
    permission_classes = [IsAdmin]
    queryset = ActivityLog.objects.select_related("user")
    filterset_fields = ["action", "model_name", "user"]
    search_fields = ["detail"]
