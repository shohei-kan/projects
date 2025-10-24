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
    EmployeeActiveRangeView,   # ← これを使う
)

router = DefaultRouter()
router.register(r"offices", OfficeViewSet, basename="offices")
router.register(r"employees", EmployeeViewSet, basename="employees")
router.register(r"records", RecordViewSet, basename="records")
router.register(r"confirmations", SupervisorConfirmationViewSet, basename="confirmations")

urlpatterns = [
    # --- 個別エンドポイント（router より前に置く）---

    # ① 従業員アクティブ範囲（パスパラメータ版）
    path(
        "employees/<int:pk>/active_range/",
        EmployeeActiveRangeView.as_view(),
        name="employee-active-range",
    ),
    # ② 従業員アクティブ範囲（クエリ版：/employees/active_range/?employee_id=5）
    path(
        "employees/active_range/",
        EmployeeActiveRangeView.as_view(),
        name="employee-active-range-query",
    ),

    path("records/submit", SubmitRecordView.as_view(), name="records-submit"),
    path("dashboard", DashboardView.as_view(), name="dashboard"),
    path("records/calendar_status/", CalendarStatusView.as_view(), name="calendar-status"),
    path(
        "records/<int:pk>/supervisor_confirm/",
        RecordSupervisorConfirmView.as_view(),
        name="record-supervisor-confirm",
    ),
    path("branches/", OfficeViewSet.as_view({"get": "list"}), name="branches-alias"),

    # router 配下（/offices/, /employees/, /records/, /confirmations/）
    path("", include(router.urls)),

    path("records/<int:pk>/clear/", RecordClearView.as_view(), name="record-clear"),
    # （↓この supervisor_confirm は重複しているなら片方でOK）
    path("records/<int:pk>/supervisor_confirm/", RecordSupervisorConfirmView.as_view(), name="record-supconfirm"),
]
