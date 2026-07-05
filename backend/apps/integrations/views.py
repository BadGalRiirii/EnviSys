"""Google OAuth flow + Drive helpers.

Flow:
1. GET  /api/integrations/google/authorize/  → returns the Google consent URL.
2. Google redirects to /api/integrations/google/callback/?code=...&state=...
   which stores the tokens and bounces back to the frontend.
3. POST /api/integrations/google/create-doc/ → creates a Google Doc in the
   group's Drive folder and returns the link for saving as a ThesisDocument.
"""
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.groups.models import ThesisGroup

from .models import GoogleCredential
from .services import GoogleNotConfigured, create_google_doc


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


class GoogleAuthorizeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not settings.GOOGLE_CLIENT_ID:
            return Response(
                {"detail": "Google integration is not configured (GOOGLE_CLIENT_ID missing)."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        # Carry the user's identity through OAuth "state" as a short-lived JWT.
        state = str(AccessToken.for_user(request.user))
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(settings.GOOGLE_OAUTH_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return Response({"authorization_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"})


class GoogleCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get("code")
        state = request.query_params.get("state", "")
        if not code:
            return redirect(f"{settings.FRONTEND_URL}/settings?google=error")
        try:
            user_id = AccessToken(state)["user_id"]
            user = User.objects.get(pk=user_id)
        except Exception:  # noqa: BLE001
            return redirect(f"{settings.FRONTEND_URL}/settings?google=error")

        token_response = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=15,
        ).json()

        GoogleCredential.objects.update_or_create(
            user=user,
            defaults={
                "token": token_response.get("access_token", ""),
                "refresh_token": token_response.get("refresh_token", ""),
            },
        )
        return redirect(f"{settings.FRONTEND_URL}/settings?google=connected")


class GoogleStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        connected = GoogleCredential.objects.filter(user=request.user).exists()
        return Response({"connected": connected})


class CreateGoogleDocView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        group_id = request.data.get("group_id")
        title = request.data.get("title", "Untitled thesis document")
        group = ThesisGroup.objects.filter(pk=group_id).first()
        if not group:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)
        credential = GoogleCredential.objects.filter(user=request.user).first()
        if not credential:
            return Response(
                {"detail": "Connect your Google account first (Settings → Connect Google)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            payload = create_google_doc(credential, group, title)
        except GoogleNotConfigured as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(payload, status=status.HTTP_201_CREATED)
