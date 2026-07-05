"""Thesis groups, membership, adviser assignment, and panel nomination.

Manuscript mapping:
- Student_Groups / Group_Members tables (Fig. 3.4).
- Objective 4: dynamic member addition/removal, no hard-coded size limits.
- Objective 5: editable thesis title.
- Objective 7: one adviser per group, verified faculty only.
- Objective 15: panel nomination requiring admin validation.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class ThesisStage(models.TextChoices):
    CONCEPT = "CONCEPT", "Concept"
    PROPOSAL = "PROPOSAL", "Proposal"
    FINAL = "FINAL", "Final Defense"


class GroupStatus(models.TextChoices):
    PENDING = "PENDING", "Pending Approval"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class ThesisGroup(models.Model):
    name = models.CharField(max_length=255)
    thesis_title = models.CharField(
        max_length=500, blank=True,
        help_text="Editable working title (Objective 5).",
    )
    adviser = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="advised_groups",
        help_text="Exactly one adviser at a time; must be verified faculty.",
    )
    stage = models.CharField(max_length=10, choices=ThesisStage.choices, default=ThesisStage.CONCEPT)
    status = models.CharField(max_length=10, choices=GroupStatus.choices, default=GroupStatus.PENDING)
    ready_for_defense = models.BooleanField(
        default=False,
        help_text="Marked when the group is ready for the current stage's defense (Objective 17).",
    )
    drive_folder_id = models.CharField(max_length=128, blank=True)
    drive_folder_link = models.URLField(blank=True)
    is_archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="created_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    def clean(self):
        if self.adviser and not getattr(self.adviser, "is_verified_faculty", False):
            raise ValidationError({"adviser": "Adviser must be a verified faculty account."})


class GroupMember(models.Model):
    class MemberRole(models.TextChoices):
        LEADER = "LEADER", "Leader"
        MEMBER = "MEMBER", "Member"

    group = models.ForeignKey(ThesisGroup, on_delete=models.CASCADE, related_name="members")
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="group_memberships"
    )
    member_role = models.CharField(max_length=10, choices=MemberRole.choices, default=MemberRole.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["group", "student"], name="unique_group_membership")
        ]

    def __str__(self):
        return f"{self.student} in {self.group}"


class PanelAssignment(models.Model):
    """Panel nomination workflow (Objective 15): nominated → admin validates."""

    class NominationStatus(models.TextChoices):
        NOMINATED = "NOMINATED", "Nominated"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    group = models.ForeignKey(ThesisGroup, on_delete=models.CASCADE, related_name="panel_assignments")
    faculty = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="panel_assignments"
    )
    status = models.CharField(
        max_length=10, choices=NominationStatus.choices, default=NominationStatus.NOMINATED
    )
    nominated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="panel_nominations_made",
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="panel_nominations_decided",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["group", "faculty"], name="unique_panel_per_group")
        ]

    def __str__(self):
        return f"{self.faculty} → {self.group} ({self.status})"


class Milestone(models.Model):
    """Deadline-bearing milestones per group (enhancement beyond the manuscript).

    Powers dashboard visibility and automated deadline reminders
    (see notifications' send_deadline_reminders command).
    """

    group = models.ForeignKey(ThesisGroup, on_delete=models.CASCADE, related_name="milestones")
    title = models.CharField(max_length=255)
    stage = models.CharField(max_length=10, choices=ThesisStage.choices)
    due_date = models.DateField()
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="created_milestones",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["due_date"]

    def __str__(self):
        return f"{self.group}: {self.title} (due {self.due_date})"
