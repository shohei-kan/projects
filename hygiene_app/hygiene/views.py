# hygiene/views.py
from django.db import transaction
from django.utils.dateparse import parse_date, parse_time
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Office, Employee, Record, RecordItem, SupervisorConfirmation
from .serializers import (
    OfficeSerializer,
    EmployeeSerializer,
    RecordSerializer,
    SupervisorConfirmationSerializer,
)

# =========================
# Read APIs
# =========================

class OfficeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Office.objects.all()
    serializer_class = OfficeSerializer
    permission_classes = [permissions.AllowAny]  # 認証導入までは緩め


class EmployeeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Employee.objects.select_related("office")
        branch = self.request.query_params.get("branch_code")
        if branch:
            qs = qs.filter(office__code=branch)
        return qs.order_by("code")


# views.py の RecordViewSet を差し替え
class RecordViewSet(viewsets.ModelViewSet):
    serializer_class = RecordSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Record.objects.select_related("employee").prefetch_related("items").all()
        emp_code = self.request.query_params.get("employee_code")
        date_str = self.request.query_params.get("date")
        if emp_code:
            qs = qs.filter(employee__code=emp_code)
        if date_str:
            from django.utils.dateparse import parse_date
            d = parse_date(date_str)
            if d:
                qs = qs.filter(date=d)
        return qs.order_by("id")


class SupervisorConfirmationViewSet(viewsets.ModelViewSet):
    queryset = SupervisorConfirmation.objects.all()
    serializer_class = SupervisorConfirmationSerializer
    permission_classes = [permissions.AllowAny]


class RecordsQueryView(APIView):
    """
    GET /api/records/?employee_code=100002&date=2025-08-25
    フロント互換：配列で返却（該当なしなら []）
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        emp_code = request.query_params.get("employee_code")
        date_str = request.query_params.get("date")
        d = parse_date(date_str) if date_str else None
        if not (emp_code and d):
            return Response([], status=status.HTTP_200_OK)

        rec = (
            Record.objects.select_related("employee")
            .prefetch_related("items")
            .filter(employee__code=emp_code, date=d)
            .first()
        )
        if not rec:
            return Response([], status=status.HTTP_200_OK)

        payload = {
            "id": rec.id,
            "date": rec.date.isoformat(),
            "employee": rec.employee_id,
            "work_start_time": rec.work_start_time.isoformat(timespec="minutes") if rec.work_start_time else None,
            "work_end_time": rec.work_end_time.isoformat(timespec="minutes") if rec.work_end_time else None,
            "items": [
                {
                    "id": it.id,
                    "category": it.category,
                    "is_normal": it.is_normal,
                    "value": it.value,
                    "comment": it.comment,
                }
                for it in rec.items.all()
            ],
        }
        return Response([payload], status=status.HTTP_200_OK)


class DashboardView(APIView):
    """
    GET /api/dashboard?branch_code=KM3076&date=2025-08-25
    フロントの getDashboardStaffRows と同じ形で返す
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        branch = request.query_params.get("branch_code")
        date_str = request.query_params.get("date")
        d = parse_date(date_str) if date_str else None
        if not branch or not d:
            return Response({"detail": "branch_code と date は必須です。"}, status=status.HTTP_400_BAD_REQUEST)

        employees = Employee.objects.select_related("office").filter(office__code=branch).order_by("code")
        rows = []
        for emp in employees:
            rec = (
                Record.objects.filter(employee=emp, date=d)
                .prefetch_related("items")
                .first()
            )
            temperature = None
            symptoms = False
            comment = ""
            arrival = bool(rec and rec.work_start_time)
            departure = bool(rec and rec.work_end_time)

            if rec:
                for it in rec.items.all():
                    if it.category == "temperature" and it.value is not None:
                        try:
                            temperature = float(it.value)
                        except Exception:
                            temperature = it.value
                    # 症状フラグは体調関連のみで判定
                    if (
                        it.category in ("no_health_issues", "family_no_symptoms", "no_respiratory_symptoms")
                        and not it.is_normal
                    ):
                        symptoms = True
                        if it.comment:
                            comment = (comment + " / " if comment else "") + it.comment

            rows.append(
                {
                    "id": emp.code,  # フロント互換：従業員コード
                    "name": emp.name,
                    "arrivalRegistered": arrival,
                    "departureRegistered": departure,
                    "temperature": temperature,
                    "symptoms": symptoms,
                    "comment": comment,
                }
            )
        return Response({"rows": rows}, status=status.HTTP_200_OK)


# =========================
# Write API (フォーム保存)
# =========================

class SubmitRecordView(APIView):
    """
    POST /api/records/submit
    {
      "employee_code": "000001",
      "date": "2025-08-25",
      "work_start_time": "08:30",   // 省略可 or null
      "work_end_time": "17:15",     // 省略可 or null
      "items": [
        {"category":"temperature","is_normal":true,"value":36.6},
        {"category":"proper_uniform","is_normal":false,"comment":"エプロン忘れ"}
      ],
      "supervisor_confirmed": true  // 任意
    }
    """
    permission_classes = [permissions.AllowAny]  # 本番は認証に切り替え

    def post(self, request):
        data = request.data or {}

        employee_code = data.get("employee_code")
        date_str = data.get("date")
        if not employee_code or not date_str:
            return Response(
                {"detail": "employee_code と date は必須です。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        d = parse_date(date_str)
        if not d:
            return Response({"detail": "date は YYYY-MM-DD 形式で指定してください。"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            emp = Employee.objects.get(code=employee_code)
        except Employee.DoesNotExist:
            return Response({"detail": "employee not found"}, status=status.HTTP_404_NOT_FOUND)

        work_start_time = data.get("work_start_time")  # "HH:MM" or null
        work_end_time = data.get("work_end_time")      # "HH:MM" or null
        items = data.get("items") or []
        supervisor_confirmed = data.get("supervisor_confirmed", None)

        with transaction.atomic():
            rec, _ = Record.objects.get_or_create(date=d, employee=emp)

            # 時刻は "HH:MM" 文字列なら parse_time で変換（None 指定も可）
            if work_start_time is not None:
                rec.work_start_time = parse_time(work_start_time) if isinstance(work_start_time, str) else work_start_time
            if work_end_time is not None:
                rec.work_end_time = parse_time(work_end_time) if isinstance(work_end_time, str) else work_end_time
            rec.save()

            # 明細 upsert
            for it in items:
                cat = it.get("category")
                if not cat:
                    continue

                defaults = {
                    "is_normal": bool(it.get("is_normal")),
                    "value": None,
                    "comment": (it.get("comment") or ""),
                }
                val = it.get("value", None)
                if val not in ("", None):
                    try:
                        defaults["value"] = float(val)
                    except (TypeError, ValueError):
                        defaults["value"] = None

                RecordItem.objects.update_or_create(
                    record=rec, category=cat, defaults=defaults
                )

            # 責任者確認（任意）
            if supervisor_confirmed is not None:
                if supervisor_confirmed:
                    SupervisorConfirmation.objects.get_or_create(record=rec)
                else:
                    SupervisorConfirmation.objects.filter(record=rec).delete()

        return Response({"ok": True}, status=status.HTTP_200_OK)
