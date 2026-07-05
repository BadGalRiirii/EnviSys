from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .models import ThesisStatusHistory, ThesisTopic


class ThesisTopicSerializer(serializers.ModelSerializer):
    submitted_by = UserSerializer(read_only=True)
    reviewed_by = UserSerializer(read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta:
        model = ThesisTopic
        fields = [
            "id", "group", "group_name", "title", "abstract", "status",
            "submitted_by", "reviewed_by", "feedback", "created_at", "updated_at",
        ]
        read_only_fields = ["status", "feedback"]


class ThesisStatusHistorySerializer(serializers.ModelSerializer):
    changed_by = UserSerializer(read_only=True)

    class Meta:
        model = ThesisStatusHistory
        fields = ["id", "group", "from_status", "to_status", "changed_by", "remarks", "created_at"]
