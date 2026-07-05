"""Departmental progress reporting (DFD process: 'report generation').

Gives the chairperson a live picture of thesis progress across the
department; faculty and students receive the same summary scoped to
their own groups.
"""
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from apps.defenses.models import DefenseSchedule, ScheduleStatus
from apps.documents.models import DocumentStatus, ThesisDocument
from apps.groups.models import Milestone, PanelAssignment, ThesisGroup
from apps.theses.models import ThesisTopic, TopicStatus


class SummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        groups = ThesisGroup.objects.filter(is_archived=False)
        if user.role == Role.FACULTY:
            groups = groups.filter(
                Q(adviser=user)
                | Q(panel_assignments__faculty=user, panel_assignments__status="APPROVED")
            ).distinct()
        elif user.role == Role.STUDENT:
            groups = groups.filter(members__student=user).distinct()

        group_ids = list(groups.values_list("id", flat=True))
        today = timezone.localdate()

        by_stage = dict(
            groups.values_list("stage").annotate(n=Count("id")).values_list("stage", "n")
        )
        summary = {
            "groups_total": len(group_ids),
            "groups_by_stage": {
                "CONCEPT": by_stage.get("CONCEPT", 0),
                "PROPOSAL": by_stage.get("PROPOSAL", 0),
                "FINAL": by_stage.get("FINAL", 0),
            },
            "groups_ready_for_defense": groups.filter(ready_for_defense=True).count(),
            "pending_topics": ThesisTopic.objects.filter(
                group_id__in=group_ids, status=TopicStatus.PENDING
            ).count(),
            "pending_documents": ThesisDocument.objects.filter(
                group_id__in=group_ids, status=DocumentStatus.PENDING
            ).count(),
            "upcoming_defenses": DefenseSchedule.objects.filter(
                group_id__in=group_ids,
                status=ScheduleStatus.APPROVED,
                date__gte=today,
                date__lte=today + timedelta(days=14),
            ).count(),
            "overdue_milestones": Milestone.objects.filter(
                group_id__in=group_ids, is_completed=False, due_date__lt=today
            ).count(),
        }
        if user.is_admin_role:
            summary["pending_group_approvals"] = ThesisGroup.objects.filter(
                is_archived=False, status="PENDING"
            ).count()
            summary["pending_panel_nominations"] = PanelAssignment.objects.filter(
                status="NOMINATED"
            ).count()
            summary["pending_schedules"] = DefenseSchedule.objects.filter(
                status=ScheduleStatus.PROPOSED
            ).count()
            summary["pending_results"] = DefenseSchedule.objects.filter(
                status=ScheduleStatus.APPROVED, result__isnull=True
            ).count()
            summary["archived_theses"] = ThesisGroup.objects.filter(is_archived=True).count()
        return Response(summary)
