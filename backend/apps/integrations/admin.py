from django.contrib import admin

from .models import GoogleCredential


@admin.register(GoogleCredential)
class GoogleCredentialAdmin(admin.ModelAdmin):
    list_display = ("user", "google_email", "updated_at")
