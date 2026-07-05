"""Serializers for authentication and user management."""
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Role, User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "username", "first_name", "last_name", "full_name",
            "role", "specialization", "is_verified_faculty", "student_id",
            "is_email_verified", "date_joined",
        ]
        read_only_fields = ["role", "is_verified_faculty", "is_email_verified", "date_joined"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class AdviserSerializer(serializers.ModelSerializer):
    """Adviser directory entry with workload visibility (Objective 7)."""

    full_name = serializers.SerializerMethodField()
    active_advisees = serializers.IntegerField(read_only=True)
    match_score = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "full_name", "email", "specialization", "active_advisees", "match_score"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_match_score(self, obj):
        return getattr(obj, "match_score", None)


class StudentRegistrationSerializer(serializers.ModelSerializer):
    """Self-service student signup with institutional-email enforcement."""

    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["email", "username", "first_name", "last_name", "student_id", "password"]

    def validate_email(self, value):
        domain = settings.INSTITUTIONAL_EMAIL_DOMAIN
        if domain and not value.lower().endswith(f"@{domain}"):
            raise serializers.ValidationError(
                f"Please register using your institutional email (@{domain})."
            )
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate(self, attrs):
        # Objective 10: prevent duplicate registrations using the same name.
        if User.objects.filter(
            first_name__iexact=attrs.get("first_name", ""),
            last_name__iexact=attrs.get("last_name", ""),
        ).exists():
            raise serializers.ValidationError(
                {"first_name": "An account with this full name already exists."}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(role=Role.STUDENT, **validated_data)
        user.set_password(password)
        user.save()
        return user


class FacultyCreateSerializer(serializers.ModelSerializer):
    """Admin-only creation of adviser/panel accounts (Objectives 9 & 11)."""

    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = [
            "email", "username", "first_name", "last_name",
            "specialization", "is_verified_faculty", "password",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(role=Role.FACULTY, **validated_data)
        user.set_password(password)
        user.save()
        return user


class EnviSysTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT login that embeds role claims and blocks unverified emails."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.get_full_name() or user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_email_verified and not self.user.is_superuser:
            raise serializers.ValidationError(
                "Your institutional email is not yet verified. Please check your inbox."
            )
        data["user"] = UserSerializer(self.user).data
        return data


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(validators=[validate_password])
