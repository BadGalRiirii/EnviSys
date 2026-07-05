from django.urls import path

from . import views

urlpatterns = [
    path("google/authorize/", views.GoogleAuthorizeView.as_view(), name="google-authorize"),
    path("google/callback/", views.GoogleCallbackView.as_view(), name="google-callback"),
    path("google/status/", views.GoogleStatusView.as_view(), name="google-status"),
    path("google/create-doc/", views.CreateGoogleDocView.as_view(), name="google-create-doc"),
]
