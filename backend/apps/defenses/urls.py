from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("schedules", views.DefenseScheduleViewSet, basename="schedules")

urlpatterns = [path("", include(router.urls))]
