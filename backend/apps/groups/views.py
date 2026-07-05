"""Thesis group management endpoints."""
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import IsAdmin, IsVerifiedUser
from apps.audit.services import record_action
from apps.defenses.models import Verdict
from apps.notifications.services import notify_group, notify_user

from .models import GroupMember, GroupStatus, PanelAssignment, ThesisGroup, ThesisStage
from .serializers import (
    GroupMemberSerializer,
    PanelAssignmentSerializer,
    ThesisGroupSerializer,
)


def _is_member(user, group):
    return group.members.filter(student=user).exists()


def _is_adviser_or_admin(user, group):
    return user.is_admin_role or user.id == getattr(group.adviser, "id", None)


def _has_active_group(student, exclude_group_id=None):
    qs = GroupMember.objects.filter(student=student, group__is_archived=False)
    if exclude_group_id:
        qs = qs.exclude(group_id=exclude_group_id)
    return qs.exists()


class ThesisGroupViewSet(viewsets.ModelViewSet):
    serializer_class = ThesisGroupSerializer
    permission_classes = [IsAuthenticated, IsVerifiedUser]
    filterset_fields = ["stage", "status", "is_archived", "adviser"]
    search_fields = ["name", "thesis_title"]

    def get_queryset(self):
        user = self.request.user
        qs = ThesisGroup.objects.select_related("adviser").prefetch_related(
            "members__student", "panel_assignments__faculty"
        )
        if user.is_admin_role:
            return qs
        # Archived theses form the department's digital repository and stay
        # browsable (read-only) by everyone; active views filter them out
        # client-side via ?is_archived=false.
        if user.role == Role.FACULTY:
            return qs.filter(models_q_adviser_or_panel(user) | Q_archived()).distinct()
        return qs.filter(Q_members(user) | Q_archived()).distinct()

    def perform_create(self, serializer):
        if self.request.user.role == Role.STUDENT and _has_active_group(self.request.user):
            raise ValidationError(
                {"detail": "You're already a member of an active thesis group — leave it before creating another."}
            )
        group = serializer.save(created_by=self.request.user)
        if self.request.user.role == Role.STUDENT:
            GroupMember.objects.create(
                group=group, student=self.request.user,
                member_role=GroupMember.MemberRole.LEADER,
            )
        record_action(self.request.user, "CREATE_GROUP", "ThesisGroup", group.pk, group.name)

    def perform_update(self, serializer):
        if "adviser" in serializer.validated_data:
            if not (self.request.user.is_admin_role or _is_member(self.request.user, serializer.instance)):
                raise PermissionDenied("Only group members or the chairperson can assign an adviser.")
            candidate = serializer.validated_data["adviser"]
            if candidate and serializer.instance.panel_assignments.filter(
                faculty=candidate, status="APPROVED"
            ).exists():
                raise ValidationError(
                    {"detail": "This faculty member is already an approved panelist of this group and can't also be its adviser."}
                )
        group = serializer.save()
        record_action(self.request.user, "UPDATE_GROUP", "ThesisGroup", group.pk, "Group updated")

    # -------------------- membership (Objective 4) --------------------
    @action(detail=True, methods=["post"], serializer_class=GroupMemberSerializer)
    def add_member(self, request, pk=None):
        group = self.get_object()
        if not (request.user.is_admin_role or _is_member(request.user, group)):
            raise PermissionDenied("Only group members or the chairperson can manage membership.")
        serializer = GroupMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if _has_active_group(serializer.validated_data["student"], exclude_group_id=group.pk):
            raise ValidationError(
                {"detail": "That student is already a member of another active thesis group."}
            )
        member = serializer.save(group=group)
        record_action(request.user, "ADD_MEMBER", "ThesisGroup", group.pk, str(member.student))
        notify_user(
            member.student, "Added to thesis group",
            f"You have been added to the thesis group “{group.name}”.",
        )
        return Response(GroupMemberSerializer(member).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def remove_member(self, request, pk=None):
        group = self.get_object()
        if not (request.user.is_admin_role or _is_member(request.user, group)):
            raise PermissionDenied("Only group members or the chairperson can manage membership.")
        member = group.members.filter(pk=request.data.get("member_id")).first()
        if not member:
            return Response({"detail": "Member not found."}, status=status.HTTP_404_NOT_FOUND)
        record_action(request.user, "REMOVE_MEMBER", "ThesisGroup", group.pk, str(member.student))
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -------------------- adviser assignment --------------------
    @action(detail=True, methods=["post"])
    def assign_adviser(self, request, pk=None):
        group = self.get_object()
        if not (request.user.is_admin_role or _is_member(request.user, group)):
            raise PermissionDenied("Only group members or the chairperson can assign an adviser.")
        serializer = ThesisGroupSerializer(
            group, data={"adviser_id": request.data.get("adviser_id")}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        candidate = serializer.validated_data.get("adviser")
        if candidate and group.panel_assignments.filter(faculty=candidate, status="APPROVED").exists():
            raise ValidationError(
                {"detail": "This faculty member is already an approved panelist of this group and can't also be its adviser."}
            )
        serializer.save()
        record_action(request.user, "ASSIGN_ADVISER", "ThesisGroup", group.pk, str(group.adviser))
        if group.adviser:
            notify_user(
                group.adviser, "New advisee group",
                f"You have been assigned as adviser of “{group.name}”.",
            )
            notify_group(group, "Adviser assigned", f"{group.adviser.get_full_name()} is now your adviser.")
        return Response(serializer.data)

    # -------------------- admin decisions --------------------
    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        group = self.get_object()
        group.status = GroupStatus.APPROVED
        group.save(update_fields=["status"])
        record_action(request.user, "APPROVE_GROUP", "ThesisGroup", group.pk, "Group approved")
        notify_group(group, "Group approved", f"Your thesis group “{group.name}” has been approved.")
        return Response(ThesisGroupSerializer(group).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def reject(self, request, pk=None):
        group = self.get_object()
        group.status = GroupStatus.REJECTED
        group.save(update_fields=["status"])
        record_action(request.user, "REJECT_GROUP", "ThesisGroup", group.pk, "Group rejected")
        notify_group(group, "Group rejected", f"Your thesis group “{group.name}” was not approved.")
        return Response(ThesisGroupSerializer(group).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def archive(self, request, pk=None):
        group = self.get_object()
        group.is_archived = True
        group.save(update_fields=["is_archived"])
        record_action(request.user, "ARCHIVE_GROUP", "ThesisGroup", group.pk, "Group archived")
        return Response({"detail": "Group archived."})

    # -------------------- stage & readiness (Objectives 14 & 17) --------------------
    @action(detail=True, methods=["post"])
    def mark_ready(self, request, pk=None):
        group = self.get_object()
        group.ready_for_defense = True
        group.save(update_fields=["ready_for_defense"])
        record_action(
            request.user, "MARK_READY", "ThesisGroup", group.pk,
            f"Marked ready for {group.get_stage_display()} defense",
        )
        if group.adviser:
            notify_user(
                group.adviser, "Group ready for defense",
                f"“{group.name}” is marked ready for its {group.get_stage_display()} defense.",
            )
        return Response(ThesisGroupSerializer(group).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def advance_stage(self, request, pk=None):
        group = self.get_object()
        order = [ThesisStage.CONCEPT, ThesisStage.PROPOSAL, ThesisStage.FINAL]
        idx = order.index(group.stage)
        if idx >= len(order) - 1:
            return Response({"detail": "Group is already at the final stage."},
                            status=status.HTTP_400_BAD_REQUEST)
        latest_schedule = group.defense_schedules.filter(stage=group.stage, result__isnull=False) \
            .order_by("-date", "-time").first()
        if latest_schedule and latest_schedule.result.verdict in (Verdict.FAILED, Verdict.REDEFENSE):
            return Response(
                {"detail": "This group's latest defense result was not a pass — it cannot advance yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        group.stage = order[idx + 1]
        group.ready_for_defense = False
        group.save(update_fields=["stage", "ready_for_defense"])
        record_action(request.user, "ADVANCE_STAGE", "ThesisGroup", group.pk,
                      f"Advanced to {group.get_stage_display()}")
        notify_group(group, "Stage advanced",
                     f"Your thesis is now in the {group.get_stage_display()} stage.")
        return Response(ThesisGroupSerializer(group).data)

    # -------------------- panel workflow (Objective 15) --------------------
    @action(detail=True, methods=["post"], serializer_class=PanelAssignmentSerializer)
    def nominate_panel(self, request, pk=None):
        group = self.get_object()
        if not _is_adviser_or_admin(request.user, group):
            raise PermissionDenied("Only the group's adviser or the chairperson can nominate panel members.")
        serializer = PanelAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        faculty = serializer.validated_data["faculty"]
        if group.adviser_id == faculty.id:
            raise ValidationError(
                {"detail": "This group's adviser can't also be nominated as a panelist."}
            )
        assignment, _created = PanelAssignment.objects.update_or_create(
            group=group,
            faculty=serializer.validated_data["faculty"],
            defaults={
                "status": PanelAssignment.NominationStatus.NOMINATED,
                "nominated_by": request.user,
                "decided_by": None,
                "decided_at": None,
            },
        )
        record_action(request.user, "NOMINATE_PANEL", "ThesisGroup", group.pk, str(assignment.faculty))
        return Response(PanelAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)


class PanelAssignmentViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin review queue for panel nominations."""

    serializer_class = PanelAssignmentSerializer
    permission_classes = [IsAdmin]
    queryset = PanelAssignment.objects.select_related("group", "faculty")
    filterset_fields = ["status", "group"]

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._decide(request, PanelAssignment.NominationStatus.APPROVED)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._decide(request, PanelAssignment.NominationStatus.REJECTED)

    def _decide(self, request, decision):
        assignment = self.get_object()
        assignment.status = decision
        assignment.decided_by = request.user
        assignment.decided_at = timezone.now()
        assignment.save(update_fields=["status", "decided_by", "decided_at"])
        record_action(request.user, f"PANEL_{decision}", "PanelAssignment", assignment.pk,
                      f"{assignment.faculty} for {assignment.group}")
        notify_user(
            assignment.faculty, "Panel assignment update",
            f"Your panel nomination for “{assignment.group.name}” was {decision.lower()}.",
        )
        return Response(PanelAssignmentSerializer(assignment).data)


def models_q_adviser_or_panel(user):
    from django.db.models import Q

    return Q(adviser=user) | Q(
        panel_assignments__faculty=user,
        panel_assignments__status=PanelAssignment.NominationStatus.APPROVED,
    )


def Q_archived():
    from django.db.models import Q

    return Q(is_archived=True)


def Q_members(user):
    from django.db.models import Q

    return Q(members__student=user)


class MilestoneViewSet(viewsets.ModelViewSet):
    """Milestones with due dates; anyone in the group can complete them."""

    permission_classes = [IsAuthenticated, IsVerifiedUser]
    filterset_fields = ["group", "stage", "is_completed"]

    def get_serializer_class(self):
        from .serializers import MilestoneSerializer

        return MilestoneSerializer

    def get_queryset(self):
        from .models import Milestone

        user = self.request.user
        qs = Milestone.objects.select_related("group")
        if user.is_admin_role:
            return qs
        if user.role == Role.FACULTY:
            return qs.filter(models_q_milestone(user)).distinct()
        return qs.filter(group__members__student=user).distinct()

    def perform_create(self, serializer):
        milestone = serializer.save(created_by=self.request.user)
        record_action(self.request.user, "CREATE_MILESTONE", "Milestone", milestone.pk, milestone.title)
        notify_group(milestone.group, "New milestone",
                     f"“{milestone.title}” is due on {milestone.due_date}.")

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        milestone = self.get_object()
        milestone.is_completed = True
        milestone.completed_at = timezone.now()
        milestone.save(update_fields=["is_completed", "completed_at"])
        record_action(request.user, "COMPLETE_MILESTONE", "Milestone", milestone.pk, milestone.title)
        notify_group(milestone.group, "Milestone completed",
                     f"“{milestone.title}” has been marked complete.", include_adviser=True)
        return Response(self.get_serializer(milestone).data)


def models_q_milestone(user):
    from django.db.models import Q

    return Q(group__adviser=user) | Q(
        group__panel_assignments__faculty=user,
        group__panel_assignments__status="APPROVED",
    )
