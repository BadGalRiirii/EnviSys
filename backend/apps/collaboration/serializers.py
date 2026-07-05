from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .models import Comment


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "group", "document", "author", "body", "created_at"]
        read_only_fields = ["group"]
