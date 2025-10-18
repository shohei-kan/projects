# hygiene/serializers.py
from rest_framework import serializers
from .models import Office, Employee, Record, RecordItem, SupervisorConfirmation

# ===== write（/api/records/submit 用）=====
class RecordItemWriteSerializer(serializers.Serializer):
    category = serializers.CharField(max_length=100)
    is_normal = serializers.BooleanField()
    value = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    value_text = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    comment = serializers.CharField(required=False, allow_null=True, allow_blank=True)

class RecordWriteSerializer(serializers.Serializer):
    employee_code = serializers.CharField(max_length=20)
    date = serializers.DateField()
    work_start_time = serializers.TimeField(required=False, allow_null=True)
    work_end_time   = serializers.TimeField(required=False, allow_null=True)
    supervisor_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    supervisor_confirmed = serializers.BooleanField(required=False)
    work_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)  # "off" | "work"
    items = RecordItemWriteSerializer(many=True, required=False)

# ===== read =====
class OfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = "__all__"

class EmployeeSerializer(serializers.ModelSerializer):
    office_name = serializers.CharField(source="office.name", read_only=True)
    class Meta:
        model = Employee
        fields = ("id", "code", "name", "office", "office_name")

class RecordItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecordItem
        fields = ("id", "category", "is_normal", "value", "value_text", "comment")
        read_only_fields = fields

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        try:
            rep["value"] = float(rep["value"]) if rep["value"] is not None else None
        except Exception:
            rep["value"] = None
        if rep.get("value_text", "") == "":
            rep["value_text"] = None
        if rep.get("comment", "") == "":
            rep["comment"] = ""
        return rep

    def validate(self, attrs):
        cat = attrs.get("category", getattr(self.instance, "category", None))
        val = attrs.get("value", getattr(self.instance, "value", None))
        is_normal = attrs.get("is_normal", getattr(self.instance, "is_normal", True))
        comment = attrs.get("comment", getattr(self.instance, "comment", ""))

        if is_normal is False and not comment:
            raise serializers.ValidationError("is_normal=false の場合、comment は必須です。")

        if cat == "temperature" and val is not None:
            try:
                if float(val) >= 37.5 and is_normal:
                    raise serializers.ValidationError("体温が37.5℃以上のとき is_normal を true にはできません。")
            except (TypeError, ValueError):
                pass
        return attrs

class RecordSerializer(serializers.ModelSerializer):
    items = RecordItemSerializer(many=True, read_only=True)
    supervisor_code = serializers.SerializerMethodField()
    supervisor_confirmed = serializers.SerializerMethodField()  # ★ 追加
    is_off = serializers.BooleanField(read_only=True)
    work_type = serializers.CharField(read_only=True)
    status = serializers.SerializerMethodField()
    status_jp = serializers.SerializerMethodField()

    class Meta:
        model = Record
        fields = (
            "id", "date", "employee",
            "work_start_time", "work_end_time",
            "items",
            "supervisor_selected", "supervisor_code", "supervisor_confirmed",
            "is_off", "work_type",
            "status", "status_jp",
        )
        read_only_fields = fields

    def get_supervisor_code(self, obj):
        sc = getattr(obj, "supervisor_confirmation", None)
        if sc and getattr(sc, "confirmed_by_id", None) and getattr(sc.confirmed_by, "code", None):
            return sc.confirmed_by.code
        return getattr(getattr(obj, "supervisor_selected", None), "code", None)

    def get_supervisor_confirmed(self, obj) -> bool:
        """
        ViewSet 側の annotate(supervisor_confirmed=...) があればそれを返す。
        無ければ OneToOne の存在で判定（prefetch 済みなら追加クエリなし）。
        """
        annotated = getattr(obj, "supervisor_confirmed", None)
        if annotated is not None:
            return bool(annotated)
        try:
            # 逆参照が無ければ RelatedObjectDoesNotExist が飛ぶことがあるので握りつぶす
            _ = obj.supervisor_confirmation
            return True
        except Exception:
            return False

    # ---- ステータス ----
    def _status_code(self, obj) -> str:
        if getattr(obj, "is_off", False) or getattr(obj, "work_type", None) == "off":
            return "off"
        if getattr(obj, "work_end_time", None):
            return "left"
        if getattr(obj, "work_start_time", None):
            return "arrived"
        return "none"

    def get_status(self, obj):
        return self._status_code(obj)

    def get_status_jp(self, obj):
        return {"off": "休み", "left": "退勤入力済", "arrived": "出勤入力済", "none": "-"}.get(
            self._status_code(obj), "-"
        )

class SupervisorConfirmationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupervisorConfirmation
        fields = "__all__"
        read_only_fields = ("confirmed_at",)
