# hygiene/views.py
from django.utils.dateparse import parse_date
from django.db import transaction
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


class RecordViewSet(viewsets.ModelViewSet):
    serializer_class = RecordSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = (
            Record.objects
            .select_related("employee", "supervisor_selected")  # ← 追加
            .prefetch_related(
                "items",
                "supervisor_confirmation",
                "supervisor_confirmation__confirmed_by",
            )
        )
        emp_code = self.request.query_params.get("employee_code")
        date_str = self.request.query_params.get("date")
        if emp_code:
            qs = qs.filter(employee__code=emp_code)
        if date_str:
            qs = qs.filter(date=date_str)
        return qs.order_by("date", "employee__code")


class SupervisorConfirmationViewSet(viewsets.ModelViewSet):
    queryset = SupervisorConfirmation.objects.all()
    serializer_class = SupervisorConfirmationSerializer
    permission_classes = [permissions.AllowAny]


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
                    # 体調系の異常で symptoms を立てる
                    if it.category in ("no_health_issues", "family_no_symptoms", "no_respiratory_symptoms") and not it.is_normal:
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
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data or {}
        print("[SubmitRecordView] payload =", data)  # docker compose logs -f backend で確認可

        employee_code = data.get("employee_code")
        date_str = data.get("date")
        if not employee_code or not date_str:
            return Response({"detail": "employee_code と date は必須です。"},
                            status=status.HTTP_400_BAD_REQUEST)

        d = parse_date(date_str)
        if not d:
            return Response({"detail": "date は YYYY-MM-DD 形式で指定してください。"},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            emp = Employee.objects.get(code=employee_code)
        except Employee.DoesNotExist:
            return Response({"detail": "employee not found"}, status=status.HTTP_400_BAD_REQUEST)

        work_start_time = data.get("work_start_time")  # "HH:MM" or null
        work_end_time   = data.get("work_end_time")    # "HH:MM" or null
        items = data.get("items") or []
        supervisor_code = data.get("supervisor_code") or None

        with transaction.atomic():
            rec, _ = Record.objects.get_or_create(date=d, employee=emp)

            # None のときは上書きしない（null を送ってきたら null にする）
            if work_start_time is not None:
                rec.work_start_time = work_start_time
            if work_end_time is not None:
                rec.work_end_time = work_end_time

            # ★ 正しいフィールド名（models.Record.supervisor_selected）に保存
            if supervisor_code:
                sup = Employee.objects.filter(code=supervisor_code).first()
                if not sup:
                    return Response({"detail": "supervisor not found"}, status=status.HTTP_400_BAD_REQUEST)
                rec.supervisor_selected = sup

            rec.save()

            # 明細 upsert（カテゴリ一意）
            for it in items:
                cat = (it.get("category") or "").strip()
                if not cat:
                    continue
                raw_val = it.get("value", None)
                if raw_val in ("", None):
                    val = None
                else:
                    try:
                        val = float(raw_val)
                    except Exception:
                        val = None  # 数値化できなければ value は None に寄せる

                defaults = {
                    "is_normal": bool(it.get("is_normal")),
                    "value": val,
                    "comment": (it.get("comment") or "").strip(),
                }
                RecordItem.objects.update_or_create(
                    record=rec, category=cat, defaults=defaults
                )

        return Response({"status": "ok"}, status=status.HTTP_200_OK)
