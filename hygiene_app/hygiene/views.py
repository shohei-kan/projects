# hygiene/views.py
from datetime import date as _date
from django.db import transaction,IntegrityError,models
from django.db.models import Q, Count, Exists, OuterRef,Min, Max
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
# Write API (フォーム保存) 置き換え
# =========================
class SubmitRecordView(APIView):
    permission_classes = [permissions.AllowAny]

    @staticmethod
    def _normalize_work_type(s):
        if not s:
            return None
        s = str(s).strip().lower()
        return s if s in ("off", "work") else None

    @transaction.atomic
    def post(self, request):
        data = request.data or {}
        employee_code = data.get("employee_code")
        date_str = data.get("date")
        if not employee_code or not date_str:
            return Response({"detail": "employee_code と date は必須です。"}, status=status.HTTP_400_BAD_REQUEST)

        d = parse_date(date_str)
        if not d:
            return Response({"detail": "date は YYYY-MM-DD 形式で指定してください。"}, status=status.HTTP_400_BAD_REQUEST)

        emp = Employee.objects.filter(code=employee_code).first()
        if not emp:
            return Response({"detail": "employee not found"}, status=status.HTTP_400_BAD_REQUEST)

        # 受信値
        has_start_key = "work_start_time" in data
        has_end_key   = "work_end_time" in data
        req_start     = data.get("work_start_time", None)
        req_end       = data.get("work_end_time", None)

        supervisor_code = data.get("supervisor_code")
        supervisor = Employee.objects.filter(code=supervisor_code).first() if supervisor_code else None

        top_level_work_type = self._normalize_work_type(data.get("work_type"))
        items = data.get("items") or []

        # items 内の work_type を最優先で解釈
        item_work_type = None
        for it in items:
            if (it.get("category") or "").strip().lower() == "work_type":
                vtxt = it.get("value_text") or it.get("value")
                item_work_type = self._normalize_work_type(vtxt)
                break
        decided_work_type = item_work_type or top_level_work_type

        # --- レコードをロックして取得 or 新規作成 ---
        rec = (
            Record.objects.select_for_update()
            .filter(date=d, employee=emp)
            .first()
        )
        created = False
        if rec is None:
            rec = Record.objects.create(date=d, employee=emp)
            created = True

        ignored, applied = [], []

        # --- 退勤済みなら以降の時刻変更は全て無視（items は許可） ---
        if rec.work_end_time:
            if has_start_key: ignored.append("work_start_time: already left")
            if has_end_key:   ignored.append("work_end_time: already left")
            # work_type の変更も無視（確定後の取り違え防止）
            if decided_work_type:
                ignored.append("work_type: already left")

        else:
            # --- work_type の適用（休日設定/解除） ---
            if decided_work_type in ("off", "work"):
                # 出勤/退勤済みがあれば 'off' への切替は無視（取り違え防止）
                if decided_work_type == "off" and (rec.work_start_time or rec.work_end_time):
                    ignored.append("work_type: cannot change to off after check-in/out")
                else:
                    # 設定を反映
                    rec.work_type = decided_work_type
                    rec.is_off = decided_work_type == "off"
                    applied.append(f"work_type={decided_work_type}")
                    # 休日は時刻クリア
                    if rec.is_off:
                        if rec.work_start_time: applied.append("clear work_start_time (off)")
                        if rec.work_end_time:   applied.append("clear work_end_time (off)")
                        rec.work_start_time = None
                        rec.work_end_time = None

            # --- 勤務日のみ時刻を受け付ける ---
            if not rec.is_off:
                # 出勤
                if has_start_key:
                    if rec.work_start_time:
                        ignored.append("work_start_time: already set")
                    elif req_start in (None, ""):
                        ignored.append("work_start_time: empty")
                    else:
                        rec.work_start_time = req_start
                        applied.append(f"work_start_time={req_start}")

                # 退勤
                if has_end_key:
                    if not rec.work_start_time:
                        # サーバ側ガード（出勤前に退勤は不可）
                        return Response({"detail": "出勤が未登録のため、退勤は登録できません。"}, status=status.HTTP_400_BAD_REQUEST)
                    if rec.work_end_time:
                        ignored.append("work_end_time: already set")
                    elif req_end in (None, ""):
                        ignored.append("work_end_time: empty")
                    else:
                        rec.work_end_time = req_end
                        applied.append(f"work_end_time={req_end}")
            else:
                # 休日中は時刻系を無視
                if has_start_key: ignored.append("work_start_time: ignored on off day")
                if has_end_key:   ignored.append("work_end_time: ignored on off day")

        # 確認者（任意で保持）
        if supervisor is not None:
            rec.supervisor_selected = supervisor
            applied.append(f"supervisor_selected={supervisor.code}")

        rec.save()

        # --- 明細 upsert（ここは従来通り。休日/退勤済でも許可） ---
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

        # --- 責任者確認（任意） ---
        supervisor_confirmed = data.get("supervisor_confirmed", None)
        if supervisor_confirmed is not None:
            if supervisor_confirmed:
                SupervisorConfirmation.objects.update_or_create(
                    record=rec, defaults={"confirmed_by": supervisor, "confirmed_at": timezone.now()}
                )
                applied.append("supervisor_confirmed=True")
            else:
                SupervisorConfirmation.objects.filter(record=rec).delete()
                applied.append("supervisor_confirmed=False")

        # UI 向けステータス
        status_code = (
            "off" if rec.is_off or rec.work_type == "off"
            else ("left" if rec.work_end_time else ("arrived" if rec.work_start_time else "none"))
        )
        status_jp = {"off": "休み", "left": "退勤入力済", "arrived": "出勤入力済", "none": "-"}.get(status_code, "-")

        return Response({
            "id": rec.id,
            "created": created,
            "status": status_code,
            "status_jp": status_jp,
            "applied": applied,
            "ignored": ignored,
        }, status=status.HTTP_200_OK)

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
# =========================
# 記録のクリア
# =========================

class RecordClearView(APIView):
    permission_classes = [permissions.AllowAny]

    @transaction.atomic  # ★ これが重要
    def post(self, request, pk: int):
        # トランザクション内なら select_for_update を安全に使える
        rec = get_object_or_404(Record.objects.select_for_update(), pk=pk)

        # 関連レコードの削除
        RecordItem.objects.filter(record=rec).delete()
        SupervisorConfirmation.objects.filter(record=rec).delete()

        # 本体を初期化（勤務区分/休みフラグもリセット）
        rec.work_start_time = None
        rec.work_end_time = None
        rec.work_type = None
        rec.is_off = None
        rec.supervisor_selected = None
        rec.save(update_fields=[
            "work_start_time", "work_end_time",
            "work_type", "is_off", "supervisor_selected"
        ])

        return Response({"status": "ok"}, status=status.HTTP_200_OK)
    
class EmployeeActiveRangeView(APIView):
    """
    GET /api/employees/<pk>/active_range/
    もしくは GET /api/employees/active_range/?employee_id=123 や ?employee_code=100001
    レコードが初めて登録された年月(YYYY-MM) 〜 今日(YYYY-MM) を返す
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk: int | None = None):
        emp_id = pk or request.query_params.get("employee_id")
        emp_code = request.query_params.get("employee_code")

        if emp_code and not emp_id:
            emp = get_object_or_404(Employee, code=str(emp_code))
        else:
            if not emp_id:
                return Response({"detail": "employee_id または employee_code を指定してください。"}, status=400)
            emp = get_object_or_404(Employee, pk=emp_id)

        # その従業員の最初の記録日を取得（なければ今日）
        agg = Record.objects.filter(employee=emp).aggregate(first=Min("date"))
        start = agg["first"] or timezone.localdate()
        end = timezone.localdate()
        if start > end:
            start = end

        startYm = f"{start.year:04d}-{start.month:02d}"
        endYm = f"{end.year:04d}-{end.month:02d}"
        return Response({"startYm": startYm, "endYm": endYm})