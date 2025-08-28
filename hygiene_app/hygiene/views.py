# hygiene/views.py
from django.utils.dateparse import parse_date
from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes

from .models import Office, Employee, Record, RecordItem, SupervisorConfirmation
from .serializers import (
    OfficeSerializer,
    EmployeeSerializer,
    RecordSerializer,
    SupervisorConfirmationSerializer,
)

# ----- Read APIs -----

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
    queryset = Record.objects.all().prefetch_related("items")
    serializer_class = RecordSerializer
    permission_classes = [permissions.AllowAny]

class SupervisorConfirmationViewSet(viewsets.ModelViewSet):
    queryset = SupervisorConfirmation.objects.all()
    serializer_class = SupervisorConfirmationSerializer
    permission_classes = [permissions.AllowAny]

class DashboardView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        branch = request.query_params.get("branch_code")
        date_str = request.query_params.get("date")
        d = parse_date(date_str) if date_str else None
        if not branch or not d:
            return Response({"detail": "branch_code と date は必須です。"}, status=400)

        employees = Employee.objects.filter(office__code=branch).order_by("code")
        rows = []
        for emp in employees:
            rec = (
                Record.objects.filter(employee=emp, date=d)
                .prefetch_related("items")
                .first()
            )
            temp = None
            symptoms = False
            comment = ""
            arrival = bool(rec and rec.work_start_time)
            departure = bool(rec and rec.work_end_time)
            if rec:
                for it in rec.items.all():
                    if it.category == "temperature" and it.value is not None:
                        # value を数値に寄せる（文字列の場合があるため）
                        try:
                            temp = float(it.value)
                        except Exception:
                            temp = it.value
                    if not it.is_normal:
                        symptoms = True
                        if it.comment:
                            comment = (comment + " / " if comment else "") + it.comment
            rows.append(
                {
                    "id": f"{d.isoformat()}-{emp.code}",
                    "name": emp.name,
                    "arrivalRegistered": arrival,
                    "departureRegistered": departure,
                    "temperature": temp,
                    "symptoms": symptoms,
                    "comment": comment,
                }
            )
        return Response({"rows": rows})

# ----- Write API (フォーム保存) -----

class SubmitRecordView(APIView):
    """
    POST /api/records/submit
    {
      "employee_code": "000001",
      "date": "2025-08-25",
      "work_start_time": "08:30",   // 省略可
      "work_end_time": "17:15",     // 省略可
      "items": [
        {"category":"temperature","is_normal":true,"value":36.6},
        {"category":"proper_uniform","is_normal":false,"comment":"エプロン忘れ"}
      ]
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
            return Response({"detail": "date は YYYY-MM-DD 形式で指定してください。"}, status=400)

        try:
            emp = Employee.objects.get(code=employee_code)
        except Employee.DoesNotExist:
            return Response({"detail": "employee not found"}, status=400)

        work_start_time = data.get("work_start_time")  # "HH:MM" or null
        work_end_time = data.get("work_end_time")      # "HH:MM" or null
        items = data.get("items") or []

        # 文字列を time に任せたい場合は Django の TimeField にそのまま渡してOK（モデル側で型変換）
        with transaction.atomic():
            rec, _ = Record.objects.get_or_create(date=d, employee=emp)
            if work_start_time is not None:
                rec.work_start_time = work_start_time
            if work_end_time is not None:
                rec.work_end_time = work_end_time
            rec.save()

            for it in items:
                cat = it.get("category")
                if not cat:
                    continue
                defaults = {
                    "is_normal": bool(it.get("is_normal")),
                    "value": None if it.get("value") in ("", None) else str(it.get("value")),
                    "comment": it.get("comment"or ""),
                }
                RecordItem.objects.update_or_create(
                    record=rec, category=cat, defaults=defaults
                )

        return Response({"status": "ok"})
