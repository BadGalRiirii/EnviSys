from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = ["id", "user", "action", "model_name", "object_id", "detail", "created_at"]
