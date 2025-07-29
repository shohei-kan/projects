from rest_framework import serializers
from .models import Employee, SanitationCheck

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = '__all__'

class SanitationCheckSerializer(serializers.ModelSerializer):
    day_of_week = serializers.ReadOnlyField()

    class Meta:
        model = SanitationCheck
        fields = '__all__'
