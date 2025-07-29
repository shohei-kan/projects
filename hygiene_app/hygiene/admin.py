from django.contrib import admin
from .models import Employee, SanitationCheck

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('name', 'department')

@admin.register(SanitationCheck)
class SanitationCheckAdmin(admin.ModelAdmin):
    list_display = (
        'date',
        'employee',
        'temperature',
        'is_feeling_well',
        'cohabitant_sick',
        'cough_or_sore_throat',
        'proper_uniform',
        'verifier_name',
        'supervisor_signature'
    )
    list_filter = ('employee', 'date', 'is_feeling_well')
    search_fields = ('employee__name', 'verifier_name')

# Register your models here.
