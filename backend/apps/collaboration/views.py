"""REST fallback for discussion threads (history load + posting without WS)."""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import Role
from apps.accounts.permissions import IsVerifiedUser

from .models import Comment
from .serializers import CommentSerializer


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated, IsVerifiedUser]
    filterset_fields = ["group", "document"]
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        user = self.request.user
        qs = Comment.objects.select_related("author", "group")
        if user.is_admin_role:
            return qs
        if user.role == Role.FACULTY:
            from django.db.models import Q

            return qs.filter(
                Q(group__adviser=user)
                | Q(group__panel_assignments__faculty=user,
                    group__panel_assignments__status="APPROVED")
            ).distinct()
        return qs.filter(group__members__student=user).distinct()

    def perform_create(self, serializer):
        comment = serializer.save(
            author=self.request.user, group_id=self.request.data.get("group")
        )
        # Fan out to the live room so WS clients see REST-posted messages too.
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer

            async_to_sync(get_channel_layer().group_send)(
                f"group_{comment.group_id}",
                {"type": "comment", "payload": CommentSerializer(comment).data},
            )
        except Exception:  # noqa: BLE001 — realtime must never break the API
            pass
