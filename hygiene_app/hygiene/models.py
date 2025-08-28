from django.db import models

class Office(models.Model):
    code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    name = models.CharField(max_length=100)
    management_pin = models.CharField(max_length=4, blank=True)  # 開発用

    def __str__(self):
        return f"{self.code} {self.name}"

class Employee(models.Model):
    code = models.CharField(max_length=20, unique=True, null=True, blank=True)  # ←今はこれでOK
    name = models.CharField(max_length=100)
    office = models.ForeignKey(Office, on_delete=models.PROTECT, related_name="employees", null=False, blank=False)



    def __str__(self):
        return f"{self.code} {self.name}"

class Record(models.Model):
    date = models.DateField()
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="records")
    work_start_time = models.TimeField(null=True, blank=True)
    work_end_time = models.TimeField(null=True, blank=True)

    class Meta:
        unique_together = ("date", "employee")

    def __str__(self):
        return f"{self.date} - {self.employee.code}"

CATEGORIES = [
    ("temperature", "temperature"),
    ("no_health_issues", "no_health_issues"),
    ("family_no_symptoms", "family_no_symptoms"),
    ("no_respiratory_symptoms", "no_respiratory_symptoms"),
    ("no_severe_hand_damage", "no_severe_hand_damage"),
    ("no_mild_hand_damage", "no_mild_hand_damage"),
    ("nails_groomed", "nails_groomed"),
    ("proper_uniform", "proper_uniform"),
    ("no_work_illness", "no_work_illness"),
    ("proper_handwashing", "proper_handwashing"),
]

class RecordItem(models.Model):
    record = models.ForeignKey(Record, on_delete=models.CASCADE, related_name="items")
    category = models.CharField(max_length=40, choices=CATEGORIES)
    is_normal = models.BooleanField(default=True)
    value = models.FloatField(null=True, blank=True)      # 体温など数値系
    comment = models.TextField(blank=True)

    class Meta:
        unique_together = ("record", "category")

class SupervisorConfirmation(models.Model):
    record = models.OneToOneField(Record, on_delete=models.CASCADE, related_name="supervisor_confirmation")
    confirmed_by = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL)
    confirmed_at = models.DateTimeField(auto_now_add=True)
