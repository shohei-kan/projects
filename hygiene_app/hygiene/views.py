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
        print("[SubmitRecordView] payload =", data)

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

        # 文字列 or null をそのまま TimeField に渡してOK（モデル側で変換される）
        work_start_time = data.get("work_start_time")   # "HH:MM" or null or 未指定(None)
        work_end_time   = data.get("work_end_time")     # "HH:MM" or null or 未指定(None)

        # supervisor（確認者）
        supervisor_code = data.get("supervisor_code")
        supervisor = None
        if supervisor_code:
            supervisor = Employee.objects.filter(code=supervisor_code).first()
            if supervisor is None:
                return Response({"detail": "supervisor not found"}, status=status.HTTP_400_BAD_REQUEST)

        items = data.get("items") or []

        sending_start = work_start_time is not None   # 明示的に key があり、null でない
        sending_end   = work_end_time   is not None

        with transaction.atomic():
            rec, _ = Record.objects.get_or_create(date=d, employee=emp)

            # ★サーバ側ガード：出勤未登録で退勤のみはNG
            #   - 既存レコードに start が無い
            #   - リクエストでも start を送っていない
            #   - なのに end だけ送ってきた
            if sending_end and not sending_start and rec.work_start_time is None:
                return Response(
                    {"detail": "出勤が未登録のため、退勤は登録できません。先に出勤を登録してください。"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 時刻・確認者の反映（None の場合は「上書きしない」運用）
            if sending_start:
                rec.work_start_time = work_start_time
            if sending_end:
                rec.work_end_time = work_end_time
            if supervisor is not None:
                rec.supervisor_selected = supervisor
            rec.save()

            # 明細
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
                        val = None  # 数値化できない場合は value は None（コメント優先）

                defaults = {
                    "is_normal": bool(it.get("is_normal")),
                    "value": val,
                    "comment": (it.get("comment") or "").strip(),
                }
                RecordItem.objects.update_or_create(
                    record=rec, category=cat, defaults=defaults
                )

            # supervisor_confirmed（任意で使う場合）
            supervisor_confirmed = data.get("supervisor_confirmed", None)
            if supervisor_confirmed is not None:
                if supervisor_confirmed:
                    SupervisorConfirmation.objects.get_or_create(record=rec)
                else:
                    SupervisorConfirmation.objects.filter(record=rec).delete()

        return Response({"status": "ok"}, status=status.HTTP_200_OK)