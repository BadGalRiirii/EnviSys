"""Defense schedules, evaluations, and results.

Maps to Defense_Schedules, Evaluations, and Defense_Results (Fig. 3.4).
Objective 17: schedule proposals include date, time, duration, and location,
with notifications to students and panel members. Per the manuscript's
limitations, EnviSys does not auto-generate schedules — faculty propose,
the chairperson approves.
"""
from django.conf import settings
from django.db import models

from apps.groups.models import ThesisGroup, ThesisStage


class ScheduleStatus(models.TextChoices):
    PROPOSED = "PROPOSED", "Proposed"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
    COMPLETED = "COMPLETED", "Completed"


class DefenseSchedule(models.Model):
    group = models.ForeignKey(ThesisGroup, on_delete=models.CASCADE, related_name="defense_schedules")
    stage = models.CharField(max_length=10, choices=ThesisStage.choices)
    date = models.DateField()
    time = models.TimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    location = models.CharField(max_length=255)
    status = models.CharField(max_length=10, choices=ScheduleStatus.choices, default=ScheduleStatus.PROPOSED)
    proposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="proposed_schedules",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_schedules",
    )
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "time"]

    def __str__(self):
        return f"{self.group} — {self.get_stage_display()} defense on {self.date}"


class Verdict(models.TextChoices):
    PASSED = "PASSED", "Passed"
    PASSED_WITH_REVISIONS = "PASSED_WITH_REVISIONS", "Passed with Revisions"
    REDEFENSE = "REDEFENSE", "Re-defense"
    FAILED = "FAILED", "Failed"


class Evaluation(models.Model):
    """Individual adviser/panel evaluation of a defense."""

    schedule = models.ForeignKey(DefenseSchedule, on_delete=models.CASCADE, related_name="evaluations")
    evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="evaluations"
    )
    verdict = models.CharField(max_length=25, choices=Verdict.choices)
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["schedule", "evaluator"], name="one_evaluation_per_panelist")
        ]

    def __str__(self):
        return f"{self.evaluator} → {self.schedule} ({self.verdict})"


class DefenseResult(models.Model):
    """Consolidated outcome recorded by the chairperson."""

    schedule = models.OneToOneField(DefenseSchedule, on_delete=models.CASCADE, related_name="result")
    verdict = models.CharField(max_length=25, choices=Verdict.choices)
    remarks = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.schedule}: {self.verdict}"
