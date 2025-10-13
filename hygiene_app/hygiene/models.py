from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q, F

class Category(models.TextChoices):
    TEMPERATURE = "temperature", "temperature"
    NO_HEALTH_ISSUES = "no_health_issues", "no_health_issues"
    FAMILY_NO_SYMPTOMS = "family_no_symptoms", "family_no_symptoms"
    NO_RESPIRATORY_SYMPTOMS = "no_respiratory_symptoms", "no_respiratory_symptoms"
    NO_SEVERE_HAND_DAMAGE = "no_severe_hand_damage", "no_severe_hand_damage"
    NO_MILD_HAND_DAMAGE = "no_mild_hand_damage", "no_mild_hand_damage"
    NAILS_GROOMED = "nails_groomed", "nails_groomed"
    PROPER_UNIFORM = "proper_uniform", "proper_uniform"
    NO_WORK_ILLNESS = "no_work_illness", "no_work_illness"
    PROPER_HANDWASHING = "proper_handwashing", "proper_handwashing"
    WORK_TYPE = "work_type", "work_type"  # 文字値(off/work)を保存

class Office(models.Model):
    code = models.CharField(
        max_length=20, unique=True, null=True, blank=True, db_index=True,
        validators=[RegexValidator(r"^[A-Za-z]{2}\d{4}$")],
        help_text="営業所コード（例：KM3076）。"
    )
    name = models.CharField(max_length=100)
    management_pin = models.CharField(
        max_length=4, blank=True, null=True,
        validators=[RegexValidator(r"^\d{4}$")],
        help_text="管理者用PIN（開発用）。未設定可。"
    )

    class Meta:
        indexes = [models.Index(fields=["code"], name="office_code_idx")]

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} {self.name}"

class Employee(models.Model):
    code = models.CharField(
        max_length=20, unique=True, null=True, blank=True, db_index=True,
        validators=[RegexValidator(r"^[0-9]{6}$")],
        help_text="個人コード（6桁想定）。"
    )
    name = models.CharField(max_length=100)
    office = models.ForeignKey(Office, on_delete=models.PROTECT, related_name="employees")

    class Meta:
        indexes = [
            models.Index(fields=["code"], name="emp_code_idx"),
            models.Index(fields=["office", "name"], name="emp_office_name_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} {self.name}"

class Record(models.Model):
    class WorkType(models.TextChoices):
        WORK = "work", "work"
        OFF  = "off",  "off"

    date = models.DateField()
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="records")
    work_start_time = models.TimeField(null=True, blank=True)
    work_end_time   = models.TimeField(null=True, blank=True)

    # DBで確定する休み判定
    work_type = models.CharField(max_length=8, choices=WorkType.choices, null=True, blank=True, db_index=True)
    is_off = models.BooleanField(null=True, blank=True, db_index=True)

    supervisor_selected = models.ForeignKey(
        Employee, null=True, blank=True, on_delete=models.SET_NULL, related_name="supervised_records"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["date", "employee"], name="uniq_record_per_day_employee"),
            models.CheckConstraint(
                check=Q(work_end_time__isnull=True) |
                      Q(work_start_time__isnull=True) |
                      Q(work_start_time__lte=F("work_end_time")),
                name="work_start_lte_end_or_null",
            ),
        ]
        indexes = [
            models.Index(fields=["date"], name="record_date_idx"),
            models.Index(fields=["employee", "date"], name="record_emp_date_idx"),
        ]
        ordering = ["-date", "employee_id"]

    def clean_for_off(self):
        """work_type=off のときに出退勤をクリアして is_off=True に寄せる"""
        if (self.work_type or "").lower() == self.WorkType.OFF:
            self.is_off = True
            self.work_start_time = None
            self.work_end_time = None
        elif (self.work_type or "").lower() == self.WorkType.WORK:
            self.is_off = False

    def save(self, *args, **kwargs):
        self.clean_for_off()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.date} - {self.employee.code}"

class RecordItem(models.Model):
    record = models.ForeignKey(Record, on_delete=models.CASCADE, related_name="items")
    category = models.CharField(max_length=40, choices=Category.choices)
    is_normal = models.BooleanField(default=True)
    value = models.FloatField(null=True, blank=True)                 # 数値（体温など）
    value_text = models.CharField(max_length=100, null=True, blank=True, db_index=True)  # 文字（work_type等）
    comment = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["record", "category"], name="uniq_item_per_record_category"),
        ]
        indexes = [
            models.Index(fields=["record"], name="item_record_idx"),
            models.Index(fields=["category"], name="item_category_idx"),
        ]

    def __str__(self):
        return f"{self.record_id} {self.category} ({'OK' if self.is_normal else 'NG'})"

class SupervisorConfirmation(models.Model):
    record = models.OneToOneField(Record, on_delete=models.CASCADE, related_name="supervisor_confirmation")
    confirmed_by = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL)
    confirmed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"confirmed {self.record_id} at {self.confirmed_at}"
