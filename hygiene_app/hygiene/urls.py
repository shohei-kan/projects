# hygiene/urls.py（これでOK）
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OfficeViewSet, EmployeeViewSet, RecordViewSet, SupervisorConfirmationViewSet,
    DashboardView, SubmitRecordView,
)

router = DefaultRouter()  # ※ trailing_slash はデフォルトのままでOK

router.register(r"offices", OfficeViewSet, basename="offices")
router.register(r"employees", EmployeeViewSet, basename="employees")
router.register(r"records", RecordViewSet, basename="records")
router.register(r"confirmations", SupervisorConfirmationViewSet, basename="confirmations")

urlpatterns = [
    # ← 先に個別パス
    path("records/submit", SubmitRecordView.as_view(), name="records-submit"),
    path("dashboard", DashboardView.as_view(), name="dashboard"),

    # ← 後から router
    path("", include(router.urls)),
]
