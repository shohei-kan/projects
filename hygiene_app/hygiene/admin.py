from django.contrib import admin
from .models import Office, Employee, Record, RecordItem, SupervisorConfirmation

@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = ("code", "name")

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "office")
    list_filter = ("office",)
    search_fields = ("code", "name")

class RecordItemInline(admin.TabularInline):
    model = RecordItem
    extra = 0

@admin.register(Record)
class RecordAdmin(admin.ModelAdmin):
    list_display = ("date", "employee", "work_start_time", "work_end_time")
    list_filter = ("date", "employee__office")
    inlines = [RecordItemInline]

@admin.register(SupervisorConfirmation)
class SupervisorConfirmationAdmin(admin.ModelAdmin):
    list_display = ("record", "confirmed_by", "confirmed_at")
