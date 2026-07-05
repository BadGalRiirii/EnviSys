from django.contrib import admin

from .models import ThesisDocument


@admin.register(ThesisDocument)
class ThesisDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "group", "doc_type", "stage", "version", "status", "is_archived")
    list_filter = ("doc_type", "stage", "status", "is_archived")
    search_fields = ("title",)
