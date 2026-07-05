"""Helper for writing audit-log entries from any app."""


def record_action(user, action: str, model_name: str, object_id, detail: str = "") -> None:
    from .models import ActivityLog

    ActivityLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        model_name=model_name,
        object_id=str(object_id),
        detail=detail,
    )
