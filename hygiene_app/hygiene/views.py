# hygiene/views.py
from datetime import date as _date
from django.db import transaction,IntegrityError,models
from django.db.models import Q, Count, Exists, OuterRef
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Employee, Office, Record, RecordItem, SupervisorConfirmation
from .serializers import (
    EmployeeSerializer,
    EmployeeWriteSerializer,
    OfficeSerializer,
    OfficeListSerializer,
    RecordSerializer,
    SupervisorConfirmationSerializer,
)

# =========================
# Read APIs
# =========================

class OfficeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/offices/?q=横浜  などの軽い検索に対応（任意）
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = OfficeListSerializer

    def get_queryset(self):
        qs = Office.objects.only("id", "code", "name").order_by("code")
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(models.Q(name__icontains=q) | models.Q(code__icontains=q))
        return qs

# ★★★ 従業員 ViewSet：CRUD + フィルタ（office_name/name/code）
class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related("office").order_by("code")
    permission_classes = [permissions.AllowAny]  # 認証使うなら適宜変更

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return EmployeeWriteSerializer
        return EmployeeSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # 軽いフィルタ
        office_name = self.request.query_params.get("office_name")
        name_q = self.request.query_params.get("name")
        code_q = self.request.query_params.get("code")
        branch_code = self.request.query_params.get("branch_code") or self.request.query_params.get("office_code")

        if office_name:
            qs = qs.filter(office__name__icontains=office_name)
        if branch_code:
            qs = qs.filter(office__code=branch_code)
        if name_q:
            qs = qs.filter(name__icontains=name_q)
        if code_q:
            qs = qs.filter(code__icontains=code_q)
        return qs

    # 一意制約や外部キー不整合を 400 で返す
    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError as e:
            return Response({"detail": "重複した個人コード、または無効な値です。", "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except IntegrityError as e:
            return Response({"detail": "重複した個人コード、または無効な値です。", "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, *args, **kwargs):
        try:
            return super().partial_update(request, *args, **kwargs)
        except IntegrityError as e:
            return Response({"detail": "重複した個人コード、または無効な値です。", "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
# ★★★ Record 一覧（supervisor_confirmed を annotate）
class RecordViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RecordSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = (
            Record.objects
            .select_related("employee", "employee__office", "supervisor_selected")
            .prefetch_related("items", "supervisor_confirmation", "supervisor_confirmation__confirmed_by")
            .annotate(
                supervisor_confirmed=Exists(
                    SupervisorConfirmation.objects.filter(record_id=OuterRef("pk"))
                )
            )
        )

        p = self.request.query_params
        emp_code = (p.get("employee_code") or p.get("code") or "").strip()
        date_str = (p.get("date") or "").strip()
        month_str = (p.get("month") or "").strip()
        office_name = (p.get("office_name") or "").strip()
        office_code = (p.get("office_code") or "").strip()

        if emp_code:
            qs = qs.filter(employee__code__iexact=emp_code)
        if date_str:
            qs = qs.filter(date=date_str)
        elif month_str:
            try:
                y, m = map(int, month_str.split("-"))
                qs = qs.filter(date__year=y, date__month=m)
            except Exception:
                pass
        if office_code:
            qs = qs.filter(employee__office__code__iexact=office_code)
        if office_name:
            qs = qs.filter(Q(employee__office__name__iexact=office_name) | Q(employee__office__code__iexact=office_name))

        return qs.order_by("-date", "employee__code")


class SupervisorConfirmationViewSet(viewsets.ModelViewSet):
    queryset = SupervisorConfirmation.objects.select_related("record", "confirmed_by")
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
            return Response({"detail": "branch_code と date は必須です。"}, status=status.HTTP_400_BAD_REQUEST)

        employees = Employee.objects.select_related("office").filter(office__code=branch).order_by("code")

        rows = []
        for emp in employees:
            rec = (
                Record.objects
                .select_related("employee", "employee__office")
                .prefetch_related("items", "supervisor_confirmation", "supervisor_confirmation__confirmed_by")
                .filter(employee=emp, date=d)
                .first()
            )

            temperature = None
            symptoms = False
            comment = ""
            arrival = bool(rec and rec.work_start_time)
            departure = bool(rec and rec.work_end_time)
            is_off = bool(rec and rec.is_off)

            if rec:
                for it in rec.items.all():
                    if it.category == "temperature" and it.value is not None:
                        try:
                            temperature = float(it.value)
                        except Exception:
                            temperature = it.value
                    if it.category in ("no_health_issues", "family_no_symptoms", "no_respiratory_symptoms") and not it.is_normal:
                        symptoms = True
                        if it.comment:
                            comment = (comment + " / " if comment else "") + it.comment

            status_jp = "休み" if is_off else ("退勤入力済" if departure else ("出勤入力済" if arrival else "-"))
            sup_confirmed = bool(rec and getattr(rec, "supervisor_confirmation_id", None))
            sup_code = (
                rec.supervisor_confirmation.confirmed_by.code
                if sup_confirmed and getattr(rec.supervisor_confirmation, "confirmed_by_id", None)
                else None
            )
            record_id = rec.id if rec else None

            rows.append({
                "id": f"{d.isoformat()}-{emp.code}",
                "recordId": record_id,
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
            })
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
            return Response({"detail": "employee_code と date は必須です。"}, status=status.HTTP_400_BAD_REQUEST)
        d = parse_date(date_str)
        if not d:
            return Response({"detail": "date は YYYY-MM-DD 形式で指定してください。"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            emp = Employee.objects.get(code=employee_code)
        except Employee.DoesNotExist:
            return Response({"detail": "employee not found"}, status=status.HTTP_400_BAD_REQUEST)

        has_start_key = "work_start_time" in data
        has_end_key = "work_end_time" in data
        work_start_time = data.get("work_start_time", None)
        work_end_time = data.get("work_end_time", None)

        supervisor_code = data.get("supervisor_code")
        supervisor = Employee.objects.filter(code=supervisor_code).first() if supervisor_code else None

        top_level_work_type = self._normalize_work_type(data.get("work_type"))
        items = data.get("items") or []

        with transaction.atomic():
            rec, _ = Record.objects.get_or_create(date=d, employee=emp)

            # items の work_type を最優先
            item_work_type = None
            for it in items:
                if (it.get("category") or "").strip().lower() == "work_type":
                    vtxt = it.get("value_text") or it.get("value")
                    item_work_type = self._normalize_work_type(vtxt)
                    break

            decided_work_type = item_work_type or top_level_work_type or rec.work_type

            # 退勤のみは不可
            if has_end_key and not has_start_key and not rec.work_start_time:
                return Response({"detail": "出勤が未登録のため、退勤は登録できません。"}, status=status.HTTP_400_BAD_REQUEST)

            # work_type 反映
            if decided_work_type in ("off", "work"):
                rec.work_type = decided_work_type
                rec.is_off = decided_work_type == "off"
                if rec.is_off:
                    rec.work_start_time = None
                    rec.work_end_time = None

            # 勤務日のみ時刻上書き
            if not rec.is_off:
                if has_start_key:
                    rec.work_start_time = work_start_time
                if has_end_key:
                    rec.work_end_time = work_end_time

            if supervisor is not None:
                rec.supervisor_selected = supervisor

            rec.save()

            # 明細 upsert
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
                    value_text = self._normalize_work_type(vtxt)
                else:
                    raw = it.get("value", None)
                    if isinstance(raw, (int, float)) or (isinstance(raw, str) and raw.strip() != ""):
                        try:
                            value = float(raw)
                        except Exception:
                            value = None

                defaults = {"is_normal": is_normal, "value": value, "value_text": value_text, "comment": comment}
                RecordItem.objects.update_or_create(record=rec, category=cat, defaults=defaults)

            # 責任者確認
            supervisor_confirmed = data.get("supervisor_confirmed", None)
            if supervisor_confirmed is not None:
                if supervisor_confirmed:
                    SupervisorConfirmation.objects.update_or_create(
                        record=rec, defaults={"confirmed_by": supervisor, "confirmed_at": timezone.now()}
                    )
                else:
                    SupervisorConfirmation.objects.filter(record=rec).delete()

        return Response({"status": "ok"}, status=status.HTTP_200_OK)

# =========================
# Calendar status (month)
# =========================
class CalendarStatusView(APIView):
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
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk: int):
        rec = get_object_or_404(Record, pk=pk)
        supervisor_code = (request.data or {}).get("supervisor_code")
        supervisor = Employee.objects.filter(code=supervisor_code).first() if supervisor_code else None
        SupervisorConfirmation.objects.update_or_create(
            record=rec, defaults={"confirmed_by": supervisor, "confirmed_at": timezone.now()}
        )
        return Response({"status": "ok", "supervisor_confirmed": True}, status=status.HTTP_200_OK)

    def delete(self, request, pk: int):
        rec = get_object_or_404(Record, pk=pk)
        SupervisorConfirmation.objects.filter(record=rec).delete()
        return Response({"status": "ok", "supervisor_confirmed": False}, status=status.HTTP_200_OK)
