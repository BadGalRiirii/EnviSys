from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "is_verified_faculty", "is_email_verified")
    list_filter = ("role", "is_verified_faculty", "is_email_verified")
    ordering = ("email",)
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("EnviSys", {"fields": ("role", "specialization", "is_verified_faculty", "student_id", "is_email_verified")}),
    )
