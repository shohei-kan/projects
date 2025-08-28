from rest_framework import serializers
from .models import Office, Employee, Record, RecordItem, SupervisorConfirmation


class RecordItemWriteSerializer(serializers.Serializer):
    category = serializers.CharField(max_length=100)
    is_normal = serializers.BooleanField()
    value = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    comment = serializers.CharField(required=False, allow_null=True, allow_blank=True)

class RecordWriteSerializer(serializers.Serializer):
    employee_code = serializers.CharField(max_length=20)
    date = serializers.DateField()
    work_start_time = serializers.TimeField(required=False, allow_null=True)
    work_end_time   = serializers.TimeField(required=False, allow_null=True)
    supervisor_confirmed = serializers.BooleanField(required=False)
    items = RecordItemWriteSerializer(many=True, required=False)


class OfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = "__all__"

class EmployeeSerializer(serializers.ModelSerializer):
    office_name = serializers.CharField(source="office.name", read_only=True)

    class Meta:
        model = Employee
        fields = ("id","code","name","office","office_name")

class RecordItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecordItem
        fields = ("id","category","is_normal","value","comment")

    def validate(self, attrs):
        cat = attrs.get("category", getattr(self.instance, "category", None))
        val = attrs.get("value", getattr(self.instance, "value", None))
        is_normal = attrs.get("is_normal", getattr(self.instance, "is_normal", True))
        comment = attrs.get("comment", getattr(self.instance, "comment", ""))

        if not is_normal and not comment:
            raise serializers.ValidationError("is_normal=false の場合、comment は必須です。")

        if cat == "temperature" and val is not None and val >= 37.5 and is_normal:
            raise serializers.ValidationError("体温が37.5℃以上のとき is_normal を true にはできません。")
        return attrs

class RecordSerializer(serializers.ModelSerializer):
    items = RecordItemSerializer(many=True)

    class Meta:
        model = Record
        fields = ("id","date","employee","work_start_time","work_end_time","items")

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        record = Record.objects.create(**validated_data)
        for it in items:
            RecordItem.objects.create(record=record, **it)
        return record

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if items is not None:
            # まとめ更新（カテゴリ一意を保つ）
            for it in items:
                RecordItem.objects.update_or_create(
                    record=instance, category=it["category"], defaults=it
                )
        return instance

class SupervisorConfirmationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupervisorConfirmation
        fields = "__all__"
