from rest_framework import serializers

from apps.accounts.models import Role, User
from apps.accounts.serializers import UserSerializer

from .models import GroupMember, PanelAssignment, ThesisGroup


class GroupMemberSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=Role.STUDENT), source="student", write_only=True
    )

    class Meta:
        model = GroupMember
        fields = ["id", "student", "student_id", "member_role", "joined_at"]


class PanelAssignmentSerializer(serializers.ModelSerializer):
    faculty = UserSerializer(read_only=True)
    faculty_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=Role.FACULTY, is_verified_faculty=True),
        source="faculty",
        write_only=True,
    )
    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta:
        model = PanelAssignment
        fields = ["id", "group", "group_name", "faculty", "faculty_id", "status", "created_at", "decided_at"]
        read_only_fields = ["group", "status", "decided_at"]


class ThesisGroupSerializer(serializers.ModelSerializer):
    members = GroupMemberSerializer(many=True, read_only=True)
    panel_assignments = PanelAssignmentSerializer(many=True, read_only=True)
    adviser = UserSerializer(read_only=True)
    adviser_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=Role.FACULTY, is_verified_faculty=True),
        source="adviser",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ThesisGroup
        fields = [
            "id", "name", "thesis_title", "adviser", "adviser_id", "stage",
            "status", "ready_for_defense", "drive_folder_link", "is_archived",
            "members", "panel_assignments", "created_at", "updated_at",
        ]
        read_only_fields = ["status", "stage", "is_archived"]

    def validate_adviser_id(self, adviser):
        # Objective 7: single adviser at a time, verified faculty only.
        if adviser and not adviser.is_verified_faculty:
            raise serializers.ValidationError("Selected adviser is not a verified faculty account.")
        return adviser


class MilestoneSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        from .models import Milestone

        model = Milestone
        fields = [
            "id", "group", "group_name", "title", "stage", "due_date",
            "is_completed", "completed_at", "is_overdue", "created_at",
        ]
        read_only_fields = ["is_completed", "completed_at"]

    def get_is_overdue(self, obj):
        from django.utils import timezone

        return not obj.is_completed and obj.due_date < timezone.localdate()
