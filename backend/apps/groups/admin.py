from django.contrib import admin

from .models import GroupMember, PanelAssignment, ThesisGroup


class GroupMemberInline(admin.TabularInline):
    model = GroupMember
    extra = 0


class PanelAssignmentInline(admin.TabularInline):
    model = PanelAssignment
    extra = 0
    fk_name = "group"


@admin.register(ThesisGroup)
class ThesisGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "thesis_title", "adviser", "stage", "status", "ready_for_defense", "is_archived")
    list_filter = ("stage", "status", "is_archived")
    search_fields = ("name", "thesis_title")
    inlines = [GroupMemberInline, PanelAssignmentInline]
