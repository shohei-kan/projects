# backend/hygiene/models.py
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q,F


# --- カテゴリ（型安全 & 運用時のtypo防止） ---
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


# --- Office ---
class Office(models.Model):
    # ※ code は当面 null/blank 許可（既存データに配慮）。DBが揃ったら null=False に締めると良い
    code = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="営業所コード（例：KM3076）。後で null=False に締めます。",
        validators=[
            # 2英字 + 4数字（例：KM3076）。別フォーマットを許すならこのバリデータを外してOK
            RegexValidator(r"^[A-Za-z]{2}\d{4}$", message="英字2文字+数字4桁（例：KM3076）で入力してください。"),
        ],
    )
    name = models.CharField(max_length=100)
    management_pin = models.CharField(
        max_length=4,
        blank=True,
        null=True,  # 空文字より扱いやすい
        validators=[RegexValidator(r"^\d{4}$", message="数字4桁で入力してください。")],
        help_text="管理者用PIN（開発用）。未設定可。",
    )

    class Meta:
        indexes = [
            models.Index(fields=["code"], name="office_code_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} {self.name}"


# --- Employee ---
class Employee(models.Model):
    # ※ code も当面 null/blank 許可。揃ったら null=False に締める
    code = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="個人コード（例：6桁）。後で null=False に締めます。",
        validators=[
            RegexValidator(r"^[0-9]{6}$", message="数字6桁で入力してください。"),  # 必要に応じて緩めてOK
        ],
    )
    name = models.CharField(max_length=100)
    office = models.ForeignKey(
        Office,
        on_delete=models.PROTECT,
        related_name="employees",
        null=False,
        blank=False,
        help_text="所属営業所。null不可。",
    )

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


# --- Record（1日1人1レコード）---
class Record(models.Model):
    date = models.DateField()
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="records"
    )
    work_start_time = models.TimeField(null=True, blank=True)
    work_end_time = models.TimeField(null=True, blank=True)

    class Meta:
        # 1日×従業員で一意
        constraints = [
            models.UniqueConstraint(
                fields=["date", "employee"],
                name="uniq_record_per_day_employee",
            ),
            # 両方入っているときは start <= end
            models.CheckConstraint(
                check=Q(work_end_time__isnull=True) |
                    Q(work_start_time__isnull=True) |
                    Q(work_start_time__lte=F("work_end_time")),
                name="work_start_lte_end_or_null",
            )
        ]
        indexes = [
            models.Index(fields=["date"], name="record_date_idx"),
            models.Index(fields=["employee", "date"], name="record_emp_date_idx"),
        ]
        ordering = ["-date", "employee_id"]  # 新しい日付が先

    def __str__(self):
        return f"{self.date} - {self.employee.code}"


# --- RecordItem（カテゴリごと1件）---
class RecordItem(models.Model):
    record = models.ForeignKey(
        Record, on_delete=models.CASCADE, related_name="items"
    )
    category = models.CharField(max_length=40, choices=Category.choices)
    is_normal = models.BooleanField(default=True)
    # 体温など数値系：NOTE 値とコメントの両方を使う可能性があるので両方保持
    value = models.FloatField(null=True, blank=True)
    comment = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["record", "category"],
                name="uniq_item_per_record_category",
            )
        ]
        indexes = [
            models.Index(fields=["record"], name="item_record_idx"),
            models.Index(fields=["category"], name="item_category_idx"),
        ]

    def __str__(self):
        return f"{self.record_id} {self.category} ({'OK' if self.is_normal else 'NG'})"


# --- SupervisorConfirmation（責任者確認）---
class SupervisorConfirmation(models.Model):
    record = models.OneToOneField(
        Record, on_delete=models.CASCADE, related_name="supervisor_confirmation"
    )
    confirmed_by = models.ForeignKey(
        Employee, null=True, blank=True, on_delete=models.SET_NULL
    )
    confirmed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"confirmed {self.record_id} at {self.confirmed_at}"
