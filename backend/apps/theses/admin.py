from django.contrib import admin

from .models import ThesisStatusHistory, ThesisTopic


@admin.register(ThesisTopic)
class ThesisTopicAdmin(admin.ModelAdmin):
    list_display = ("title", "group", "status", "submitted_by", "created_at")
    list_filter = ("status",)
    search_fields = ("title",)


@admin.register(ThesisStatusHistory)
class ThesisStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("group", "from_status", "to_status", "changed_by", "created_at")
