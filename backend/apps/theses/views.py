"""Thesis topic proposal and adviser review workflow."""
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import IsFacultyOrAdmin, IsVerifiedUser
from apps.audit.services import record_action
from apps.notifications.services import notify_group

from .models import ThesisStatusHistory, ThesisTopic, TopicStatus
from .serializers import ThesisStatusHistorySerializer, ThesisTopicSerializer


class ThesisTopicViewSet(viewsets.ModelViewSet):
    serializer_class = ThesisTopicSerializer
    permission_classes = [IsAuthenticated, IsVerifiedUser]
    filterset_fields = ["group", "status"]
    search_fields = ["title", "abstract"]

    def get_queryset(self):
        user = self.request.user
        qs = ThesisTopic.objects.select_related("group", "submitted_by", "reviewed_by")
        if user.is_admin_role:
            return qs
        if user.role == Role.FACULTY:
            return qs.filter(group__adviser=user)
        return qs.filter(group__members__student=user).distinct()

    def perform_create(self, serializer):
        group = serializer.validated_data["group"]
        if ThesisTopic.objects.filter(group=group, status=TopicStatus.PENDING).exists():
            raise serializers.ValidationError(
                {"detail": "This group already has a topic pending review."}
            )
        topic = serializer.save(submitted_by=self.request.user)
        self._log_transition(topic, "", TopicStatus.PENDING, "Topic submitted")
        record_action(self.request.user, "SUBMIT_TOPIC", "ThesisTopic", topic.pk, topic.title)
        if topic.group.adviser:
            notify_group(
                topic.group, "Topic submitted",
                f"“{topic.title}” has been submitted for adviser review.",
                include_adviser=True,
            )

    @action(detail=True, methods=["post"], permission_classes=[IsFacultyOrAdmin])
    def approve(self, request, pk=None):
        return self._review(request, TopicStatus.APPROVED)

    @action(detail=True, methods=["post"], permission_classes=[IsFacultyOrAdmin])
    def reject(self, request, pk=None):
        return self._review(request, TopicStatus.REJECTED)

    def _review(self, request, decision):
        topic = self.get_object()
        previous = topic.status
        topic.status = decision
        topic.reviewed_by = request.user
        topic.feedback = request.data.get("feedback", topic.feedback)
        topic.save(update_fields=["status", "reviewed_by", "feedback"])
        self._log_transition(topic, previous, decision, topic.feedback)
        record_action(request.user, f"TOPIC_{decision}", "ThesisTopic", topic.pk, topic.title)
        notify_group(
            topic.group,
            f"Thesis topic {decision.lower()}",
            f"Your topic “{topic.title}” was {decision.lower()}."
            + (f" Feedback: {topic.feedback}" if topic.feedback else ""),
        )
        if decision == TopicStatus.APPROVED and not topic.group.thesis_title:
            topic.group.thesis_title = topic.title
            topic.group.save(update_fields=["thesis_title"])
        return Response(ThesisTopicSerializer(topic).data)

    @staticmethod
    def _log_transition(topic, from_status, to_status, remarks=""):
        ThesisStatusHistory.objects.create(
            group=topic.group,
            from_status=from_status,
            to_status=to_status,
            changed_by=topic.reviewed_by or topic.submitted_by,
            remarks=remarks or "",
        )


class ThesisStatusHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ThesisStatusHistorySerializer
    permission_classes = [IsAuthenticated, IsVerifiedUser]
    filterset_fields = ["group"]

    def get_queryset(self):
        user = self.request.user
        qs = ThesisStatusHistory.objects.select_related("group", "changed_by")
        if user.is_admin_role:
            return qs
        if user.role == Role.FACULTY:
            return qs.filter(group__adviser=user)
        return qs.filter(group__members__student=user).distinct()
