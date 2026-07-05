"""WebSocket consumers for live notifications and group discussions."""
import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    """Pushes notifications to the signed-in user the moment they're created."""

    async def connect(self):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close()
            return
        self.channel_group = f"user_{user.id}"
        await self.channel_layer.group_add(self.channel_group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "channel_group"):
            await self.channel_layer.group_discard(self.channel_group, self.channel_name)

    async def notify(self, event):
        await self.send(text_data=json.dumps(event["payload"]))


class GroupDiscussionConsumer(AsyncWebsocketConsumer):
    """Live discussion thread for a thesis group.

    Membership is enforced: only group members, the adviser, approved panel
    members, and the chairperson may join the room.
    """

    async def connect(self):
        user = self.scope["user"]
        self.group_id = self.scope["url_route"]["kwargs"]["group_id"]
        if not user.is_authenticated or not await self._may_join(user):
            await self.close()
            return
        self.channel_group = f"group_{self.group_id}"
        await self.channel_layer.group_add(self.channel_group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "channel_group"):
            await self.channel_layer.group_discard(self.channel_group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        """Persist an incoming message and fan it out to the room."""
        body = (json.loads(text_data or "{}").get("body") or "").strip()
        if not body:
            return
        payload = await self._save_comment(self.scope["user"], body)
        await self.channel_layer.group_send(
            self.channel_group, {"type": "comment", "payload": payload}
        )

    async def comment(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    # ------------------------------------------------------------------
    @database_sync_to_async
    def _may_join(self, user) -> bool:
        from apps.groups.models import ThesisGroup

        group = ThesisGroup.objects.filter(pk=self.group_id).first()
        if not group:
            return False
        if user.is_admin_role or group.adviser_id == user.id:
            return True
        if group.members.filter(student=user).exists():
            return True
        return group.panel_assignments.filter(faculty=user, status="APPROVED").exists()

    @database_sync_to_async
    def _save_comment(self, user, body: str) -> dict:
        from .models import Comment
        from .serializers import CommentSerializer

        comment = Comment.objects.create(group_id=self.group_id, author=user, body=body)
        return CommentSerializer(comment).data
