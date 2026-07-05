"""User accounts and role management.

Mirrors the manuscript's Users/Roles design:
- Students self-register with an institutional email and must verify it.
- Faculty (adviser/panel) accounts are created and verified by the
  Department Chairperson (admin) only — Specific Objectives 9 & 11.
- Duplicate registrations by name or email are prevented — Objective 10.
"""
import secrets

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    STUDENT = "STUDENT", "Student"
    FACULTY = "FACULTY", "Faculty (Adviser / Panel)"
    ADMIN = "ADMIN", "Department Chairperson (Admin)"


class User(AbstractUser):
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)

    # Faculty-specific fields (Objectives 6 & 8: adviser details + specialization)
    specialization = models.CharField(
        max_length=255,
        blank=True,
        help_text="Research areas, e.g. 'Water Quality, Climate Adaptation'.",
    )
    is_verified_faculty = models.BooleanField(
        default=False,
        help_text="Set by the admin. Only verified faculty are selectable as advisers or panel members.",
    )

    # Student-specific
    student_id = models.CharField(max_length=32, blank=True)

    # Email verification
    is_email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(max_length=64, blank=True)
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)

    # Password reset
    password_reset_token = models.CharField(max_length=64, blank=True)
    password_reset_sent_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["first_name", "last_name"],
                name="unique_full_name",
                violation_error_message="An account with this full name already exists.",
            )
        ]

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    # ------------------------------------------------------------------
    def issue_email_verification_token(self) -> str:
        self.email_verification_token = secrets.token_urlsafe(32)
        self.email_verification_sent_at = timezone.now()
        self.save(update_fields=["email_verification_token", "email_verification_sent_at"])
        return self.email_verification_token

    def issue_password_reset_token(self) -> str:
        self.password_reset_token = secrets.token_urlsafe(32)
        self.password_reset_sent_at = timezone.now()
        self.save(update_fields=["password_reset_token", "password_reset_sent_at"])
        return self.password_reset_token

    @property
    def is_admin_role(self) -> bool:
        return self.role == Role.ADMIN or self.is_superuser

    @property
    def is_faculty_role(self) -> bool:
        return self.role == Role.FACULTY

    @property
    def is_student_role(self) -> bool:
        return self.role == Role.STUDENT
