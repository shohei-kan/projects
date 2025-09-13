# hygiene/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    OfficeViewSet,
    EmployeeViewSet,
    RecordViewSet,
    SupervisorConfirmationViewSet,
    DashboardView,
    SubmitRecordView,
    CalendarStatusView,
)

router = DefaultRouter()
router.register(r"offices", OfficeViewSet, basename="offices")
router.register(r"employees", EmployeeViewSet, basename="employees")
router.register(r"records", RecordViewSet, basename="records")
router.register(r"confirmations", SupervisorConfirmationViewSet, basename="confirmations")

urlpatterns = [
    # 個別エンドポイント（router より先に）
    path("records/submit", SubmitRecordView.as_view(), name="records-submit"),
    path("dashboard", DashboardView.as_view(), name="dashboard"),

    # ← フロントの要求どおり `/api/records/calendar_status/`
    path("records/calendar_status/", CalendarStatusView.as_view(), name="calendar-status"),

    # router 配下（/offices/, /employees/, /records/, /confirmations/）
    path("", include(router.urls)),
]
