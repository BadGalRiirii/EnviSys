"""Document association, versioning, review, and archiving endpoints."""
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import IsAdmin, IsFacultyOrAdmin, IsVerifiedUser
from apps.audit.services import record_action
from apps.notifications.services import notify_group

from .models import DocumentStatus, DocumentType, ThesisDocument
from .serializers import ThesisDocumentSerializer


def _has_pending_document(group, doc_type, stage):
    return ThesisDocument.objects.filter(
        group=group, doc_type=doc_type, stage=stage, status=DocumentStatus.PENDING
    ).exists()


class ThesisDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = ThesisDocumentSerializer
    permission_classes = [IsAuthenticated, IsVerifiedUser]
    filterset_fields = ["group", "stage", "doc_type", "status", "is_archived"]
    search_fields = ["title"]

    def get_queryset(self):
        user = self.request.user
        qs = ThesisDocument.objects.select_related("group", "uploaded_by", "reviewed_by")
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

    def perform_create(self, serializer):
        group = serializer.validated_data["group"]
        doc_type = serializer.validated_data.get("doc_type", DocumentType.OTHER)
        stage = serializer.validated_data.get("stage")
        if stage and _has_pending_document(group, doc_type, stage):
            raise serializers.ValidationError({
                "detail": "This group already has a pending document of that type and stage."
            })
        doc = serializer.save(uploaded_by=self.request.user)
        record_action(self.request.user, "LINK_DOCUMENT", "ThesisDocument", doc.pk, doc.title)
        notify_group(
            doc.group, "Document submitted",
            f"“{doc.title}” was linked for the {doc.get_stage_display()} stage.",
            include_adviser=True,
        )

    @action(detail=True, methods=["post"])
    def new_version(self, request, pk=None):
        """Create a new version linked to this document (version lineage)."""
        parent = self.get_object()
        if _has_pending_document(parent.group, parent.doc_type, parent.stage):
            raise serializers.ValidationError({
                "detail": "This group already has a pending document of that type and stage."
            })
        serializer = ThesisDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        doc = serializer.save(
            uploaded_by=request.user,
            group=parent.group,
            previous_version=parent,
            version=parent.version + 1,
            doc_type=parent.doc_type,
            stage=parent.stage,
        )
        record_action(request.user, "NEW_VERSION", "ThesisDocument", doc.pk,
                      f"{doc.title} v{doc.version}")
        notify_group(
            doc.group, "New document version",
            f"Version {doc.version} of “{doc.title}” has been submitted.",
            include_adviser=True,
        )
        return Response(ThesisDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsFacultyOrAdmin])
    def approve(self, request, pk=None):
        return self._review(request, DocumentStatus.APPROVED, "approved")

    @action(detail=True, methods=["post"], permission_classes=[IsFacultyOrAdmin])
    def request_revision(self, request, pk=None):
        return self._review(request, DocumentStatus.REVISION, "returned for revision")

    @action(detail=True, methods=["post"], permission_classes=[IsFacultyOrAdmin])
    def reject(self, request, pk=None):
        return self._review(request, DocumentStatus.REJECTED, "rejected")

    def _review(self, request, decision, verb):
        doc = self.get_object()
        doc.status = decision
        doc.reviewed_by = request.user
        doc.feedback = request.data.get("feedback", doc.feedback)
        doc.save(update_fields=["status", "reviewed_by", "feedback"])
        record_action(request.user, f"DOC_{decision}", "ThesisDocument", doc.pk, doc.title)
        notify_group(
            doc.group, f"Document {verb}",
            f"“{doc.title}” was {verb}."
            + (f" Feedback: {doc.feedback}" if doc.feedback else ""),
        )
        return Response(ThesisDocumentSerializer(doc).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def archive(self, request, pk=None):
        doc = self.get_object()
        doc.is_archived = True
        doc.save(update_fields=["is_archived"])
        record_action(request.user, "ARCHIVE_DOCUMENT", "ThesisDocument", doc.pk, doc.title)
        return Response({"detail": "Document archived."})
