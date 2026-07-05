from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .models import ThesisDocument


class ThesisDocumentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    reviewed_by = UserSerializer(read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta:
        model = ThesisDocument
        fields = [
            "id", "group", "group_name", "title", "doc_type", "stage",
            "drive_file_id", "drive_link", "version", "previous_version",
            "status", "feedback", "uploaded_by", "reviewed_by",
            "is_archived", "created_at", "updated_at",
        ]
        read_only_fields = ["version", "previous_version", "status", "feedback", "is_archived"]
