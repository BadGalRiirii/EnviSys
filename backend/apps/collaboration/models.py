"""Discussion threads: structured communication inside each thesis group.

Extends the manuscript's Feedback use case into a persistent, real-time
conversation between students, the adviser, and approved panel members —
so collaboration no longer depends solely on Google Docs comments.
"""
from django.conf import settings
from django.db import models

from apps.documents.models import ThesisDocument
from apps.groups.models import ThesisGroup


class Comment(models.Model):
    group = models.ForeignKey(ThesisGroup, on_delete=models.CASCADE, related_name="comments")
    document = models.ForeignKey(
        ThesisDocument, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="comments",
        help_text="Optional: attach the comment to a specific document version.",
    )
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments")
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.author} on {self.group}: {self.body[:40]}"
