from django.shortcuts import render
from rest_framework import viewsets
from .models import Employee, SanitationCheck
from .serializers import EmployeeSerializer, SanitationCheckSerializer

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer

class SanitationCheckViewSet(viewsets.ModelViewSet):
    queryset = SanitationCheck.objects.all()
    serializer_class = SanitationCheckSerializer

# Create your views here.
