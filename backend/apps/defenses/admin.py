from django.contrib import admin

from .models import DefenseResult, DefenseSchedule, Evaluation


class EvaluationInline(admin.TabularInline):
    model = Evaluation
    extra = 0


@admin.register(DefenseSchedule)
class DefenseScheduleAdmin(admin.ModelAdmin):
    list_display = ("group", "stage", "date", "time", "location", "status")
    list_filter = ("stage", "status")
    inlines = [EvaluationInline]


@admin.register(DefenseResult)
class DefenseResultAdmin(admin.ModelAdmin):
    list_display = ("schedule", "verdict", "recorded_by", "created_at")
