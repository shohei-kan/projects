# hygiene/serializers.py
from typing import Any, Dict
from rest_framework import serializers
from django.db.models import Q

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
    work_end_time = serializers.TimeField(required=False, allow_null=True)
    supervisor_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    supervisor_confirmed = serializers.BooleanField(required=False)
    work_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)  # "off" | "work"
    items = RecordItemWriteSerializer(many=True, required=False)


# ===== Office =====
class OfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = "__all__"


# オフィス一覧（安全に最小限）
class OfficeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = ("id", "code", "name")


# ===== Employee（読み取り）=====
class EmployeeSerializer(serializers.ModelSerializer):
    office_name = serializers.CharField(source="office.name", read_only=True)
    position_jp = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = ("id", "code", "name", "office", "office_name", "position", "position_jp")
        read_only_fields = ("office_name", "position_jp")

    def get_position_jp(self, obj):
        # choices の日本語表示
        try:
            return obj.get_position_display()
        except Exception:
            return None


# ===== Employee（書き込み：POST/PATCH）=====
class EmployeeWriteSerializer(serializers.ModelSerializer):
    office_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Employee
        fields = ("id", "code", "name", "office", "office_name", "position")
        extra_kwargs = {
            "office": {"required": False, "allow_null": True},
            "position": {"required": False, "allow_null": True},
            "code": {"required": False, "allow_null": True},
            "name": {"required": False, "allow_null": True},
        }

    JP_TO_CODE = {
        "一般": "general",
        "副所長": "deputy_manager",
        "所長": "branch_admin",
        "本部": "manager",
    }

    def validate(self, attrs):
        # ---- write_only の office_name を先に取り出して消す（重要）----
        office_name_in = attrs.pop("office_name", None)
        if office_name_in is None:
            office_name_in = (self.initial_data.get("office_name") or "").strip()
        else:
            office_name_in = str(office_name_in).strip()

        # ---- 空文字の正規化（partial_update で空が来たら無視）----
        for k in ("office", "name", "code", "position"):
            if k in attrs and (attrs[k] == "" or attrs[k] is None):
                attrs.pop(k)

        # ---- office_name -> office（office 未指定なら名前で解決）----
        if "office" not in attrs and office_name_in:
            try:
                attrs["office"] = Office.objects.get(name=office_name_in)
            except Office.DoesNotExist:
                raise serializers.ValidationError({"office_name": "該当する営業所が見つかりません。"})

        # ---- position 日本語 -> コード ----
        if "position" in attrs and attrs["position"] is not None:
            pos = str(attrs["position"])
            if pos not in dict(Employee.Position.choices):
                mapped = self.JP_TO_CODE.get(pos)
                if not mapped:
                    raise serializers.ValidationError(
                        {"position": "position は '一般' / '副所長' / '所長' / '本部' または対応コードを指定してください。"}
                    )
                attrs["position"] = mapped

        # ---- code の軽バリデーション（送られてきた時だけ）----
        if "code" in attrs:
            code = str(attrs["code"]).strip()
            if not code.isdigit() or len(code) != 6:
                raise serializers.ValidationError({"code": "個人コードは6桁の数字で入力してください。"})
            attrs["code"] = code

        # ---- name のトリム（送られてきた時だけ）----
        if "name" in attrs:
            attrs["name"] = str(attrs["name"]).strip()

        return attrs


# ===== RecordItem（読み取り）=====
class RecordItemSerializer(serializers.ModelSerializer):
    category_jp = serializers.SerializerMethodField()

    class Meta:
        model = RecordItem
        fields = ("id", "category", "category_jp", "is_normal", "value", "value_text", "comment")
        read_only_fields = fields

    CATEGORY_JP = {
        "temperature": "体温",
        "no_health_issues": "体調に問題なし",
        "family_no_symptoms": "同居家族に症状なし",
        "no_respiratory_symptoms": "咳・喉などの症状なし",
        "no_severe_hand_damage": "手指の重度損傷なし",
        "no_mild_hand_damage": "手指の軽度損傷なし",
        "nails_groomed": "爪の清潔・整備",
        "proper_uniform": "適切なユニフォーム",
        "no_work_illness": "就業禁止疾患なし",
        "proper_handwashing": "適切な手洗い",
        "work_type": "勤務区分",
    }

    def get_category_jp(self, obj):
        return self.CATEGORY_JP.get(obj.category, obj.category)

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


# ===== Record（読み取り）=====
class RecordSerializer(serializers.ModelSerializer):
    items = RecordItemSerializer(many=True, read_only=True)
    supervisor_code = serializers.SerializerMethodField()
    supervisor_confirmed = serializers.SerializerMethodField()
    is_off = serializers.BooleanField(read_only=True)
    work_type = serializers.CharField(read_only=True)
    work_type_jp = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    status_jp = serializers.SerializerMethodField()
    statusJp = serializers.SerializerMethodField()  # camelCase 互換
    has_comment = serializers.BooleanField(read_only=True)
    abnormal_count = serializers.IntegerField(read_only=True)
    abnormal_items = serializers.SerializerMethodField()
    office_name = serializers.CharField(source="employee.office.name", read_only=True)
    office_code = serializers.CharField(source="employee.office.code", read_only=True)


    class Meta:
        model = Record
        fields = (
            "id",
            "date",
            "employee",
            "work_start_time",
            "work_end_time",
            "items",
            "supervisor_selected",
            "supervisor_code",
            "supervisor_confirmed",
            "is_off",
            "work_type",
            "work_type_jp",
            "status",
            "status_jp",
            "statusJp",
            # ↓ 一覧で使う派生値
            "has_comment",
            "abnormal_count",
            "abnormal_items",
            "office_name", 
            "office_code",
        )
        read_only_fields = fields

    def get_supervisor_code(self, obj):
        sc = getattr(obj, "supervisor_confirmation", None)
        if sc and getattr(sc, "confirmed_by_id", None) and getattr(sc.confirmed_by, "code", None):
            return sc.confirmed_by.code
        return getattr(getattr(obj, "supervisor_selected", None), "code", None)

    def get_supervisor_confirmed(self, obj) -> bool:
        annotated = getattr(obj, "supervisor_confirmed", None)
        if annotated is not None:
            return bool(annotated)
        try:
            _ = obj.supervisor_confirmation  # 関連があれば True
            return True
        except Exception:
            return False

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
        return {
            "off": "休み",
            "left": "退勤入力済",
            "arrived": "出勤入力済",
            "none": "-",
        }.get(self._status_code(obj), "-")

    def get_statusJp(self, obj):
        # camelCase 名でも同じ値を返す（フロント互換）
        return self.get_status_jp(obj)

    def get_work_type_jp(self, obj):
        wt = getattr(obj, "work_type", None)
        if wt == "off":
            return "休み"
        if wt == "work":
            return "勤務"
        return None

    def get_abnormal_items(self, obj):
        """
        is_normal=False のカテゴリ配列（重複除去）
        """
        qs = RecordItem.objects.filter(record=obj, is_normal=False).values_list("category", flat=True)
        seen, out = set(), []
        for c in qs:
            s = "" if c is None else str(c)
            if s and s not in seen:
                seen.add(s)
                out.append(s)
        return out


# ===== SupervisorConfirmation =====
class SupervisorConfirmationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupervisorConfirmation
        fields = "__all__"
        read_only_fields = ("confirmed_at",)
