from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("panel-assignments", views.PanelAssignmentViewSet, basename="panel-assignments")
router.register("milestones", views.MilestoneViewSet, basename="milestones")
router.register("", views.ThesisGroupViewSet, basename="groups")

urlpatterns = [path("", include(router.urls))]
