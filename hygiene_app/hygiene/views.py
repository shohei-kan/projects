# hygiene/views.py
from datetime import date as _date

from django.db import transaction
from django.db.models import Q, Count,Exists, OuterRef

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Employee, Office, Record, RecordItem, SupervisorConfirmation
from .serializers import (
    EmployeeSerializer,
    OfficeSerializer,
    RecordSerializer,
    SupervisorConfirmationSerializer,
)

# =========================
# Read APIs
# =========================

class OfficeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Office.objects.all()
    serializer_class = OfficeSerializer
    permission_classes = [permissions.AllowAny]


class EmployeeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Employee.objects.select_related("office")
        # branch_code / office_code の両方を許容（互換のため）
        branch = self.request.query_params.get("branch_code") or self.request.query_params.get("office_code")
        if branch:
            qs = qs.filter(office__code=branch)
        return qs.order_by("code")


class RecordViewSet(viewsets.ModelViewSet):
    serializer_class = RecordSerializer
    permission_classes = [permissions.AllowAny]

class RecordViewSet(viewsets.ModelViewSet):
    serializer_class = RecordSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = (
            Record.objects
            .select_related("employee", "employee__office", "supervisor_selected")
            .prefetch_related(
                "items",
                "supervisor_confirmation",
                "supervisor_confirmation__confirmed_by",
            )
            .annotate(   # ← これを追加
                supervisor_confirmed=Exists(
                    SupervisorConfirmation.objects.filter(record_id=OuterRef("pk"))
                )
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
    管理画面テーブル用の簡易サマリ
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        branch = request.query_params.get("branch_code")
        date_str = request.query_params.get("date")
        d = parse_date(date_str) if date_str else None
        if not branch or not d:
            return Response(
                {"detail": "branch_code と date は必須です。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employees = (
            Employee.objects.select_related("office")
            .filter(office__code=branch)
            .order_by("code")
        )

        rows = []
        for emp in employees:
            rec = (
                Record.objects
                .select_related("employee", "employee__office")
                .prefetch_related(
                    "items",
                    "supervisor_confirmation",
                    "supervisor_confirmation__confirmed_by",
                )
                .filter(employee=emp, date=d)
                .first()
            )

            temperature = None
            symptoms = False
            comment = ""
            arrival = bool(rec and rec.work_start_time)
            departure = bool(rec and rec.work_end_time)

            is_off = bool(rec and rec.is_off)
            status_jp = "-"
            if rec:
                # 体温・症状コメント
                for it in rec.items.all():
                    if it.category == "temperature" and it.value is not None:
                        try:
                            temperature = float(it.value)
                        except Exception:
                            temperature = it.value
                    if (
                        it.category
                        in ("no_health_issues", "family_no_symptoms", "no_respiratory_symptoms")
                        and not it.is_normal
                    ):
                        symptoms = True
                        if it.comment:
                            comment = (comment + " / " if comment else "") + it.comment

                # ステータス日本語
                if is_off:
                    status_jp = "休み"
                elif departure:
                    status_jp = "退勤入力済"
                elif arrival:
                    status_jp = "出勤入力済"
                else:
                    status_jp = "-"

            # supervisor_confirmation の存在判定は *_id を使うと安全
            sup_confirmed = bool(rec and getattr(rec, "supervisor_confirmation_id", None))
            sup_code = (
                rec.supervisor_confirmation.confirmed_by.code
                if sup_confirmed and getattr(rec.supervisor_confirmation, "confirmed_by_id", None)
                else None
            )

            record_id = rec.id if rec else None

            rows.append(
                {
                    # 画面用の一意ID（date-employeeCode）
                    "id": f"{d.isoformat()}-{emp.code}",
                    # APIトグル用に Record PK を返す（null の場合は未作成）
                    "recordId": record_id,
                    # 参照性高めるための明示フィールド
                    "employeeCode": emp.code,
                    "name": emp.name,
                    "arrivalRegistered": arrival,
                    "departureRegistered": departure,
                    "temperature": temperature,
                    "symptoms": symptoms,
                    "comment": comment,
                    "isOff": is_off,
                    "statusJp": status_jp,
                    "supervisorConfirmed": sup_confirmed,
                    "supervisorCode": sup_code,
                }
            )
        return Response({"rows": rows}, status=status.HTTP_200_OK)

# =========================
# Write API (フォーム保存)
# =========================

class SubmitRecordView(APIView):
    permission_classes = [permissions.AllowAny]

    @staticmethod
    def _normalize_work_type(s):
        if not s:
            return None
        s = str(s).strip().lower()
        return s if s in ("off", "work") else None

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
            return Response(
                {"detail": "date は YYYY-MM-DD 形式で指定してください。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            emp = Employee.objects.get(code=employee_code)
        except Employee.DoesNotExist:
            return Response({"detail": "employee not found"}, status=status.HTTP_400_BAD_REQUEST)

        has_start_key = "work_start_time" in data
        has_end_key = "work_end_time" in data
        work_start_time = data.get("work_start_time", None)
        work_end_time = data.get("work_end_time", None)

        supervisor_code = data.get("supervisor_code")
        supervisor = None
        if supervisor_code:
            supervisor = Employee.objects.filter(code=supervisor_code).first()
            if supervisor is None:
                return Response({"detail": "supervisor not found"}, status=status.HTTP_400_BAD_REQUEST)

        top_level_work_type = self._normalize_work_type(data.get("work_type"))
        items = data.get("items") or []

        with transaction.atomic():
            rec, _ = Record.objects.get_or_create(date=d, employee=emp)

            # items 側の work_type を最優先
            item_work_type = None
            for it in items:
                if (it.get("category") or "").strip().lower() == "work_type":
                    vtxt = it.get("value_text") or it.get("value")
                    item_work_type = self._normalize_work_type(vtxt)
                    break

            decided_work_type = item_work_type or top_level_work_type or rec.work_type

            # 退勤のみ → NG
            if has_end_key and not has_start_key and not rec.work_start_time:
                return Response(
                    {"detail": "出勤が未登録のため、退勤は登録できません。先に出勤を登録してください。"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # work_type 反映（offなら出退勤をクリア）
            if decided_work_type in ("off", "work"):
                rec.work_type = decided_work_type
                rec.is_off = decided_work_type == "off"
                if rec.is_off:
                    rec.work_start_time = None
                    rec.work_end_time = None

            # 勤務日のみ時刻を上書き
            if not rec.is_off:
                if has_start_key:
                    rec.work_start_time = work_start_time
                if has_end_key:
                    rec.work_end_time = work_end_time

            if supervisor is not None:
                rec.supervisor_selected = supervisor

            rec.save()

            # 明細保存（temperature は数値、work_type は value_text）
            for it in items:
                cat = (it.get("category") or "").strip()
                if not cat:
                    continue

                is_normal = bool(it.get("is_normal", True))
                comment = (it.get("comment") or "").strip()

                value = None
                value_text = None
                if cat == "temperature":
                    raw = it.get("value", None)
                    if raw not in ("", None):
                        try:
                            value = float(raw)
                        except Exception:
                            value = None
                elif cat == "work_type":
                    vtxt = it.get("value_text") or it.get("value")
                    vtxt = self._normalize_work_type(vtxt)
                    value_text = vtxt
                else:
                    raw = it.get("value", None)
                    if isinstance(raw, (int, float)) or (isinstance(raw, str) and raw.strip() != ""):
                        try:
                            value = float(raw)
                        except Exception:
                            value = None

                defaults = {
                    "is_normal": is_normal,
                    "value": value,
                    "value_text": value_text,
                    "comment": comment,
                }
                RecordItem.objects.update_or_create(record=rec, category=cat, defaults=defaults)

            # ★ 責任者確認：confirmed_by/confirmed_at を保存（不要なら supervisor_code を送らない）
            supervisor_confirmed = data.get("supervisor_confirmed", None)
            if supervisor_confirmed is not None:
                if supervisor_confirmed:
                    SupervisorConfirmation.objects.update_or_create(
                        record=rec,
                        defaults={"confirmed_by": supervisor, "confirmed_at": timezone.now()},
                    )
                else:
                    SupervisorConfirmation.objects.filter(record=rec).delete()

        return Response({"status": "ok"}, status=status.HTTP_200_OK)

# =========================
# Calendar status (month)
# =========================

class CalendarStatusView(APIView):
    """
    丸の条件：
      - 勤務日の退勤チェック（work_end_time が入っている）
      - 休み日（work_type='off' または is_off=true）で items 1件以上
      - 後方互換：work_type/is_off 未設定でも、start/end 両方 None かつ items>0 を休み扱い
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        emp_code = request.query_params.get("employee_code")
        month_str = request.query_params.get("month")  # "YYYY-MM"
        if not emp_code or not month_str or len(month_str) != 7:
            return Response({"dates": []}, status=status.HTTP_200_OK)

        try:
            y, m = map(int, month_str.split("-"))
            start = _date(y, m, 1)
            next_start = _date(y + (m == 12), (m % 12) + 1, 1)
        except Exception:
            return Response({"dates": []}, status=status.HTTP_200_OK)

        qs = (
            Record.objects
            .filter(employee__code=emp_code, date__gte=start, date__lt=next_start)
            .annotate(item_count=Count("items"))
            .filter(
                Q(work_type="work", work_end_time__isnull=False)
                | Q(is_off=True, item_count__gt=0)
                | Q(work_type="off", item_count__gt=0)
                | (
                    Q(work_type__isnull=True, is_off__isnull=True)
                    & Q(work_start_time__isnull=True, work_end_time__isnull=True, item_count__gt=0)
                )
            )
            .values_list("date", flat=True)
        )

        dates = [d.isoformat() for d in qs]
        return Response({"dates": dates}, status=status.HTTP_200_OK)

# =========================
# 確認トグル（管理画面向け）
# =========================

class RecordSupervisorConfirmView(APIView):
    """
    POST   /api/records/<id>/supervisor_confirm/ -> 確認ON（行を作る/更新）
    DELETE /api/records/<id>/supervisor_confirm/ -> 確認OFF（行を削除）
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk: int):
        rec = get_object_or_404(Record, pk=pk)
        supervisor_code = request.data.get("supervisor_code")
        supervisor = Employee.objects.filter(code=supervisor_code).first() if supervisor_code else None
        SupervisorConfirmation.objects.update_or_create(
            record=rec,
            defaults={"confirmed_by": supervisor, "confirmed_at": timezone.now()},
        )
        return Response({"status": "ok", "supervisor_confirmed": True}, status=status.HTTP_200_OK)

    def delete(self, request, pk: int):
        rec = get_object_or_404(Record, pk=pk)
        SupervisorConfirmation.objects.filter(record=rec).delete()
        return Response({"status": "ok", "supervisor_confirmed": False}, status=status.HTTP_200_OK)
