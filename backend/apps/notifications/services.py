"""Notification and email delivery services.

Objective 18: automated notifications for adviser approvals, revision
requests, milestone completions, deadlines, and defense schedule updates,
delivered through in-system alerts and institutional email (Brevo).

When BREVO_API_KEY is not configured, email bodies are printed to the
console so local development works without external services.
"""
import base64
import logging

from django.conf import settings

logger = logging.getLogger("envisys.notifications")

# Each attachment is (filename, content_bytes, mimetype).
Attachment = tuple[str, bytes, str]


def send_email(to: str, subject: str, body: str, attachments: list[Attachment] | None = None) -> None:
    """Send a transactional email via Brevo, or log to console in dev."""
    if not settings.BREVO_API_KEY:
        logger.info("[DEV EMAIL] to=%s subject=%s\n%s", to, subject, body)
        names = ", ".join(a[0] for a in attachments) if attachments else "none"
        print(
            f"\n--- DEV EMAIL to {to} ---\nSubject: {subject}\n\n{body}\n"
            f"Attachments: {names}\n--- end ---\n"
        )
        return
    try:
        import sib_api_v3_sdk

        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key["api-key"] = settings.BREVO_API_KEY
        api = sib_api_v3_sdk.TransactionalEmailsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )
        email_kwargs = dict(
            to=[{"email": to}],
            sender={"email": settings.DEFAULT_FROM_EMAIL, "name": "EnviSys"},
            subject=subject,
            text_content=body,
        )
        if attachments:
            email_kwargs["attachment"] = [
                {"content": base64.b64encode(content).decode(), "name": filename}
                for filename, content, _mimetype in attachments
            ]
        api.send_transac_email(sib_api_v3_sdk.SendSmtpEmail(**email_kwargs))
    except Exception:  # noqa: BLE001 — email failure must never break a request
        logger.exception("Brevo email delivery failed for %s", to)


def notify_user(
    user, title: str, message: str, link: str = "", email: bool = True,
    attachments: list[Attachment] | None = None,
) -> None:
    """Create an in-system notification and optionally email the user."""
    from .models import Notification

    notification = Notification.objects.create(user=user, title=title, message=message, link=link)
    _push_realtime(user, notification)
    if email and user.email:
        send_email(user.email, f"[EnviSys] {title}", message, attachments=attachments)


def notify_group(
    group, title: str, message: str, link: str = "", include_adviser: bool = False,
    attachments: list[Attachment] | None = None,
) -> None:
    """Notify all student members of a group (and optionally the adviser)."""
    for membership in group.members.select_related("student"):
        notify_user(membership.student, title, message, link, attachments=attachments)
    if include_adviser and group.adviser:
        notify_user(group.adviser, title, message, link, attachments=attachments)


def notify_panel(
    group, title: str, message: str, link: str = "",
    attachments: list[Attachment] | None = None,
) -> None:
    """Notify all approved panel members of a group."""
    for assignment in group.panel_assignments.filter(status="APPROVED").select_related("faculty"):
        notify_user(assignment.faculty, title, message, link, attachments=attachments)


def _push_realtime(user, notification) -> None:
    """Push a notification over WebSocket instantly; failures are silent."""
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        async_to_sync(get_channel_layer().group_send)(
            f"user_{user.id}",
            {
                "type": "notify",
                "payload": {
                    "id": notification.id,
                    "title": notification.title,
                    "message": notification.message,
                    "link": notification.link,
                    "is_read": False,
                    "created_at": notification.created_at.isoformat(),
                },
            },
        )
    except Exception:  # noqa: BLE001 — realtime must never break a request
        pass
