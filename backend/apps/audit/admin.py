from django.contrib import admin

from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("user", "action", "model_name", "object_id", "created_at")
    list_filter = ("action", "model_name")
    readonly_fields = [f.name for f in ActivityLog._meta.fields]
