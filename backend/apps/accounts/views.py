"""Authentication, registration, verification, and user directory endpoints."""
import re

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.audit.services import record_action
from apps.notifications.services import send_email

from .models import Role, User
from .permissions import IsAdmin
from .serializers import (
    AdviserSerializer,
    EnviSysTokenObtainPairSerializer,
    FacultyCreateSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    StudentRegistrationSerializer,
    UserSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = EnviSysTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class StudentRegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = StudentRegistrationSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def perform_create(self, serializer):
        user = serializer.save()
        token = user.issue_email_verification_token()
        verify_link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        send_email(
            to=user.email,
            subject="Verify your EnviSys account",
            body=(
                f"Hi {user.first_name},\n\n"
                f"Welcome to EnviSys. Please verify your institutional email by "
                f"opening the link below:\n\n{verify_link}\n\n"
                f"If you did not create this account, you can ignore this message."
            ),
        )
        record_action(user, "REGISTER", "User", user.pk, "Student self-registration")


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "token_confirm"

    def post(self, request):
        token = request.data.get("token", "")
        if not token:
            return Response({"detail": "Missing token."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(email_verification_token=token)
        except User.DoesNotExist:
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)
        if not user.is_email_verification_token_valid():
            return Response(
                {"detail": "This link has expired. Please request a new verification email."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_email_verified = True
        user.email_verification_token = ""
        user.save(update_fields=["is_email_verified", "email_verification_token"])
        record_action(user, "VERIFY_EMAIL", "User", user.pk, "Email verified")
        return Response({"detail": "Email verified. You may now log in."})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        user = User.objects.filter(email=email).first()
        if user:
            token = user.issue_password_reset_token()
            reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
            send_email(
                to=user.email,
                subject="Reset your EnviSys password",
                body=f"Open the link below to choose a new password:\n\n{reset_link}",
            )
        # Always return 200 to avoid leaking which emails exist.
        return Response({"detail": "If that email is registered, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "token_confirm"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(password_reset_token=serializer.validated_data["token"])
        except User.DoesNotExist:
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)
        if not user.is_password_reset_token_valid():
            return Response(
                {"detail": "This link has expired. Please request a new password reset."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(serializer.validated_data["password"])
        user.password_reset_token = ""
        user.save(update_fields=["password", "password_reset_token"])
        record_action(user, "RESET_PASSWORD", "User", user.pk, "Password reset completed")
        return Response({"detail": "Password updated. You may now log in."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_action(request.user, "UPDATE_PROFILE", "User", request.user.pk, "Profile updated")
        return Response(serializer.data)


_MATCH_STOPWORDS = {
    "this", "that", "with", "from", "into", "using", "based", "study",
    "analysis", "effect", "effects", "impact", "impacts", "system",
    "systems", "development", "towards", "among", "between", "their",
    "these", "those", "will", "have", "been", "were", "about", "there",
}


def _keywords(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z]{4,}", text.lower())
    return {w for w in words if w not in _MATCH_STOPWORDS}


def _group_match_text(group) -> str:
    """The group's most specific research-field text: its latest approved
    topic (title + abstract) if one exists, else its working thesis title."""
    topic = group.topics.filter(status="APPROVED").order_by("-created_at").first()
    if topic:
        return f"{topic.title} {topic.abstract}"
    return group.thesis_title or ""


class AdviserDirectoryView(generics.ListAPIView):
    """Verified advisers with specialization filtering and workload counts.

    Implements Objectives 6, 7 & 8: adviser details, workload visibility,
    and specialization tagging/filtering.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = AdviserSerializer
    search_fields = ["first_name", "last_name", "specialization"]

    def get_queryset(self):
        return (
            User.objects.filter(role=Role.FACULTY, is_verified_faculty=True)
            .annotate(
                active_advisees=Count(
                    "advised_groups",
                    filter=Q(advised_groups__is_archived=False),
                )
            )
            .order_by("last_name")
        )

    def list(self, request, *args, **kwargs):
        group_id = request.query_params.get("group")
        if not group_id:
            return super().list(request, *args, **kwargs)

        from apps.groups.models import ThesisGroup

        group = ThesisGroup.objects.filter(pk=group_id).first()
        queryset = self.filter_queryset(self.get_queryset())
        items = list(queryset)
        group_keywords = _keywords(_group_match_text(group)) if group else set()
        for item in items:
            item.match_score = len(group_keywords & _keywords(item.specialization)) if group_keywords else 0
        items.sort(key=lambda u: (-u.match_score, u.last_name))

        page = self.paginate_queryset(items)
        serializer = self.get_serializer(page if page is not None else items, many=True)
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)


class UserAdminViewSet(viewsets.ModelViewSet):
    """Admin-only user management: create faculty, verify, deactivate."""

    permission_classes = [IsAdmin]
    queryset = User.objects.all().order_by("last_name")
    filterset_fields = ["role", "is_verified_faculty", "is_email_verified"]
    search_fields = ["first_name", "last_name", "email"]

    def get_serializer_class(self):
        if self.action == "create":
            return FacultyCreateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        # Faculty accounts created by the admin are considered email-verified.
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])
        record_action(
            self.request.user, "CREATE_FACULTY", "User", user.pk,
            f"Faculty account created for {user.email}",
        )

    @action(detail=True, methods=["post"])
    def verify_faculty(self, request, pk=None):
        user = self.get_object()
        user.is_verified_faculty = True
        user.save(update_fields=["is_verified_faculty"])
        record_action(request.user, "VERIFY_FACULTY", "User", user.pk, "Faculty verified")
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        record_action(request.user, "DEACTIVATE_USER", "User", user.pk, "Account deactivated")
        return Response({"detail": "Account deactivated."})
