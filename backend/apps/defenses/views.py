"""Defense scheduling and evaluation endpoints."""
import datetime

from django.http import HttpResponse
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import IsAdmin, IsFacultyOrAdmin, IsVerifiedUser
from apps.audit.services import record_action
from apps.notifications.services import notify_group, notify_panel

from .certificate import build_certificate_pdf
from .models import DefenseResult, DefenseSchedule, Evaluation, ScheduleStatus, Verdict
from .serializers import (
    DefenseResultSerializer,
    DefenseScheduleSerializer,
    EvaluationSerializer,
)
from .services import find_conflicts, suggest_slots


class DefenseScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = DefenseScheduleSerializer
    permission_classes = [IsAuthenticated, IsVerifiedUser]
    filterset_fields = ["group", "stage", "status"]

    def get_queryset(self):
        user = self.request.user
        qs = DefenseSchedule.objects.select_related("group", "proposed_by", "approved_by")
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

    def get_permissions(self):
        if self.action == "create":
            return [IsFacultyOrAdmin()]
        return super().get_permissions()

    def perform_create(self, serializer):
        group = serializer.validated_data["group"]
        user = self.request.user
        is_panelist = group.panel_assignments.filter(faculty=user, status="APPROVED").exists()
        if not (user.is_admin_role or user.id == getattr(group.adviser, "id", None) or is_panelist):
            raise PermissionDenied("Only the group's adviser, an approved panelist, or the chairperson can propose a defense schedule.")
        conflicts = find_conflicts(
            group, serializer.validated_data["date"], serializer.validated_data["time"],
            serializer.validated_data.get("duration_minutes", 60),
            serializer.validated_data.get("location", ""),
        )
        if conflicts:
            raise serializers.ValidationError({
                "detail": "This time conflicts with a confirmed defense: "
                + "; ".join(f"{c['group_name']} ({c['reason']})" for c in conflicts)
            })
        schedule = serializer.save(proposed_by=self.request.user)
        record_action(self.request.user, "PROPOSE_SCHEDULE", "DefenseSchedule",
                      schedule.pk, str(schedule))
        notify_group(schedule.group, "Defense schedule proposed",
                     f"A {schedule.get_stage_display()} defense was proposed for "
                     f"{schedule.date} at {schedule.time} ({schedule.location}).")
        notify_panel(schedule.group, "Defense schedule proposed",
                     f"“{schedule.group.name}” has a proposed {schedule.get_stage_display()} "
                     f"defense on {schedule.date} at {schedule.time}.")

    @action(detail=False, methods=["get"])
    def check_conflicts(self, request):
        from apps.groups.models import ThesisGroup

        group_id = request.query_params.get("group")
        date_str = request.query_params.get("date")
        time_str = request.query_params.get("time")
        if not (group_id and date_str and time_str):
            return Response({"detail": "group, date, and time are required."}, status=status.HTTP_400_BAD_REQUEST)
        group = ThesisGroup.objects.filter(pk=group_id).first()
        if not group:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            date = datetime.date.fromisoformat(date_str)
            time = datetime.time.fromisoformat(time_str)
            duration_minutes = int(request.query_params.get("duration_minutes", 60))
        except ValueError:
            return Response({"detail": "Invalid date, time, or duration."}, status=status.HTTP_400_BAD_REQUEST)
        location = request.query_params.get("location", "")
        conflicts = find_conflicts(group, date, time, duration_minutes, location)
        return Response({"conflicts": conflicts})

    @action(detail=False, methods=["get"])
    def suggest_slots(self, request):
        from apps.groups.models import ThesisGroup

        group_id = request.query_params.get("group")
        if not group_id:
            return Response({"detail": "group is required."}, status=status.HTTP_400_BAD_REQUEST)
        group = ThesisGroup.objects.filter(pk=group_id).first()
        if not group:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            duration_minutes = int(request.query_params.get("duration_minutes", 60))
        except ValueError:
            return Response({"detail": "Invalid duration."}, status=status.HTTP_400_BAD_REQUEST)
        location = request.query_params.get("location", "")
        slots = suggest_slots(group, duration_minutes, location)
        return Response({"slots": slots})

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        schedule = self.get_object()
        conflicts = find_conflicts(
            schedule.group, schedule.date, schedule.time, schedule.duration_minutes,
            schedule.location, exclude_id=schedule.pk,
        )
        if conflicts:
            return Response(
                {"detail": "This time now conflicts with a confirmed defense: "
                 + "; ".join(f"{c['group_name']} ({c['reason']})" for c in conflicts)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        schedule.status = ScheduleStatus.APPROVED
        schedule.approved_by = request.user
        schedule.save(update_fields=["status", "approved_by"])
        record_action(request.user, "APPROVE_SCHEDULE", "DefenseSchedule", schedule.pk, str(schedule))
        notify_group(schedule.group, "Defense schedule approved",
                     f"Your {schedule.get_stage_display()} defense is confirmed for "
                     f"{schedule.date} at {schedule.time} ({schedule.location}).")
        notify_panel(schedule.group, "Defense schedule approved",
                     f"The {schedule.get_stage_display()} defense of “{schedule.group.name}” "
                     f"is confirmed for {schedule.date} at {schedule.time}.")
        return Response(DefenseScheduleSerializer(schedule).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def reject(self, request, pk=None):
        schedule = self.get_object()
        schedule.status = ScheduleStatus.REJECTED
        schedule.remarks = request.data.get("remarks", schedule.remarks)
        schedule.save(update_fields=["status", "remarks"])
        record_action(request.user, "REJECT_SCHEDULE", "DefenseSchedule", schedule.pk, str(schedule))
        notify_group(schedule.group, "Defense schedule rejected",
                     f"Your proposed {schedule.get_stage_display()} defense on {schedule.date} was not approved."
                     + (f" Remarks: {schedule.remarks}" if schedule.remarks else ""))
        notify_panel(schedule.group, "Defense schedule rejected",
                     f"The proposed {schedule.get_stage_display()} defense of “{schedule.group.name}” was not approved.")
        return Response(DefenseScheduleSerializer(schedule).data)

    @action(detail=True, methods=["post"], permission_classes=[IsFacultyOrAdmin],
            serializer_class=EvaluationSerializer)
    def evaluate(self, request, pk=None):
        schedule = self.get_object()
        serializer = EvaluationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evaluation, _created = Evaluation.objects.update_or_create(
            schedule=schedule,
            evaluator=request.user,
            defaults={
                "verdict": serializer.validated_data["verdict"],
                "comments": serializer.validated_data.get("comments", ""),
            },
        )
        record_action(request.user, "EVALUATE_DEFENSE", "Evaluation", evaluation.pk, str(schedule))
        return Response(EvaluationSerializer(evaluation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin],
            serializer_class=DefenseResultSerializer)
    def record_result(self, request, pk=None):
        schedule = self.get_object()
        serializer = DefenseResultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result, _created = DefenseResult.objects.update_or_create(
            schedule=schedule,
            defaults={
                "verdict": serializer.validated_data["verdict"],
                "remarks": serializer.validated_data.get("remarks", ""),
                "recorded_by": request.user,
            },
        )
        schedule.status = ScheduleStatus.COMPLETED
        schedule.save(update_fields=["status"])
        if result.verdict not in (Verdict.PASSED, Verdict.PASSED_WITH_REVISIONS):
            schedule.group.ready_for_defense = False
            schedule.group.save(update_fields=["ready_for_defense"])
        record_action(request.user, "RECORD_RESULT", "DefenseResult", result.pk, str(schedule))

        certificate = build_certificate_pdf(schedule)
        attachments = [(f"defense-certificate-{schedule.pk}.pdf", certificate, "application/pdf")]
        message = (
            f"Result for your {schedule.get_stage_display()} defense: "
            f"{result.get_verdict_display()}. The official certificate is attached."
        )
        notify_group(schedule.group, "Defense result recorded", message,
                     include_adviser=True, attachments=attachments)
        notify_panel(schedule.group, "Defense result recorded", message, attachments=attachments)
        return Response(DefenseResultSerializer(result).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def certificate(self, request, pk=None):
        schedule = self.get_object()
        if not hasattr(schedule, "result"):
            return Response(
                {"detail": "The final result hasn't been recorded for this defense yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pdf_bytes = build_certificate_pdf(schedule)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="defense-certificate-{schedule.pk}.pdf"'
        return response
