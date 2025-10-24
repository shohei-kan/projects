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
    RecordSupervisorConfirmView,
    RecordClearView,
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

    # フロント要求どおり `/api/records/calendar_status/`
    path("records/calendar_status/", CalendarStatusView.as_view(), name="calendar-status"),

    # 責任者確認 ON/OFF（管理画面向け・軽量）
    path(
        "records/<int:pk>/supervisor_confirm/",
        RecordSupervisorConfirmView.as_view(),
        name="record-supervisor-confirm",
    ),

    # 互換のための別名
    path("branches/", OfficeViewSet.as_view({"get": "list"}), name="branches-alias"),

    # router 配下（/offices/, /employees/, /records/, /confirmations/）
    path("", include(router.urls)),
    
    #記録のクリア
    path("records/<int:pk>/clear/", RecordClearView.as_view(), name="record-clear"),
]
