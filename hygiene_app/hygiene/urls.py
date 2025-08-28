# hygiene/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OfficeViewSet, EmployeeViewSet, RecordViewSet, SupervisorConfirmationViewSet,
    DashboardView, SubmitRecordView,
)

router = DefaultRouter()
router.register(r"offices", OfficeViewSet, basename="offices")
router.register(r"employees", EmployeeViewSet, basename="employees")
router.register(r"records", RecordViewSet, basename="records")
router.register(r"confirmations", SupervisorConfirmationViewSet, basename="confirmations")

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard", DashboardView.as_view()),
    path("records/submit", SubmitRecordView.as_view()),  # ← 追加
]
