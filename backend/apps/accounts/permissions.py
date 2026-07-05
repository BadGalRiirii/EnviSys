"""Role-based access control helpers used across all EnviSys apps."""
from rest_framework.permissions import BasePermission

from .models import Role


class IsAdmin(BasePermission):
    """Department Chairperson (or superuser) only."""

    def has_permission(self, request, view):
        u = request.user
        return u.is_authenticated and (u.role == Role.ADMIN or u.is_superuser)


class IsFaculty(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.FACULTY


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.STUDENT


class IsFacultyOrAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return u.is_authenticated and (u.role in (Role.FACULTY, Role.ADMIN) or u.is_superuser)


class IsVerifiedUser(BasePermission):
    """Blocks access until the account's institutional email is verified."""

    message = "Please verify your institutional email before using EnviSys."

    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_email_verified or request.user.is_superuser
        )
