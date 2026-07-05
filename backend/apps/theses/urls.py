from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("status-history", views.ThesisStatusHistoryViewSet, basename="status-history")
router.register("topics", views.ThesisTopicViewSet, basename="topics")

urlpatterns = [path("", include(router.urls))]
