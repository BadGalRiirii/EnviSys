"""Thesis topics and status history (Thesis_Topics / Thesis_Status_History).

Objective 14: enforce the sequence topic proposal → document attachment →
adviser approval with Pending / Approved / Rejected transitions.
"""
from django.conf import settings
from django.db import models

from apps.groups.models import ThesisGroup


class TopicStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class ThesisTopic(models.Model):
    group = models.ForeignKey(ThesisGroup, on_delete=models.CASCADE, related_name="topics")
    title = models.CharField(max_length=500)
    abstract = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=TopicStatus.choices, default=TopicStatus.PENDING)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="submitted_topics",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reviewed_topics",
    )
    feedback = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class ThesisStatusHistory(models.Model):
    """Audit trail of every status/stage transition for a group's thesis."""

    group = models.ForeignKey(ThesisGroup, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=50, blank=True)
    to_status = models.CharField(max_length=50)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Thesis status histories"

    def __str__(self):
        return f"{self.group}: {self.from_status} → {self.to_status}"
