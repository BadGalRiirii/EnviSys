"""Thesis documents with versioning support (Thesis_Documents, Fig. 3.4).

EnviSys does not host a text editor; documents live in Google Drive /
Google Docs and the system stores metadata, links, and version lineage
(Scope item 3 & 6, Objective 16).
"""
from django.conf import settings
from django.db import models

from apps.groups.models import ThesisGroup, ThesisStage


class DocumentStatus(models.TextChoices):
    PENDING = "PENDING", "Pending Review"
    APPROVED = "APPROVED", "Approved"
    REVISION = "REVISION", "Revision Requested"
    REJECTED = "REJECTED", "Rejected"


class DocumentType(models.TextChoices):
    CONCEPT_PAPER = "CONCEPT_PAPER", "Concept Paper"
    PROPOSAL_MANUSCRIPT = "PROPOSAL_MANUSCRIPT", "Proposal Manuscript"
    FINAL_MANUSCRIPT = "FINAL_MANUSCRIPT", "Final Manuscript"
    REVISION = "REVISION", "Revision"
    OTHER = "OTHER", "Other"


class ThesisDocument(models.Model):
    group = models.ForeignKey(ThesisGroup, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=500)
    doc_type = models.CharField(max_length=25, choices=DocumentType.choices, default=DocumentType.OTHER)
    stage = models.CharField(max_length=10, choices=ThesisStage.choices, default=ThesisStage.CONCEPT)

    # Google Workspace linkage
    drive_file_id = models.CharField(max_length=128, blank=True)
    drive_link = models.URLField(help_text="Google Docs / Drive URL of the document.")

    # Version lineage
    version = models.PositiveIntegerField(default=1)
    previous_version = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="next_versions"
    )

    status = models.CharField(max_length=10, choices=DocumentStatus.choices, default=DocumentStatus.PENDING)
    feedback = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="uploaded_documents",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reviewed_documents",
    )
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} v{self.version}"
