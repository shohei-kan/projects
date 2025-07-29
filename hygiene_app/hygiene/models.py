from django.db import models
from datetime import datetime

class Employee(models.Model):
    name = models.CharField(max_length=100, verbose_name="氏名")
    department = models.CharField(max_length=100, blank=True, null=True, verbose_name="所属班")

    def __str__(self):
        return self.name


class SanitationCheck(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, verbose_name="従業員")

    date = models.DateField(verbose_name="記録日")
    temperature = models.DecimalField(max_digits=4, decimal_places=1,default=36.0,verbose_name="体温")
    is_feeling_well = models.BooleanField(default=True, verbose_name="本人の体調異常なし")

    cohabitant_sick = models.BooleanField(default=False, verbose_name="同居者に下痢・嘔吐・発熱なし")
    cohabitant_sick_notes = models.CharField(max_length=255, blank=True, null=True, verbose_name="同居者症状備考")

    cough_or_sore_throat = models.BooleanField(default=False, verbose_name="咳・喉の腫れなし")
    cough_notes = models.CharField(max_length=255, blank=True, null=True, verbose_name="咳・喉備考")

    severe_hand_roughness = models.BooleanField(default=False, verbose_name="重度の手荒れなし")
    severe_hand_notes = models.CharField(max_length=255, blank=True, null=True, verbose_name="重度の手荒れ備考")

    mild_hand_roughness = models.BooleanField(default=False, verbose_name="軽度の手荒れなし")
    mild_hand_notes = models.CharField(max_length=255, blank=True, null=True, verbose_name="軽度の手荒れ備考")

    nails_and_beard_trimmed = models.BooleanField(default=True, verbose_name="爪・髭を切ってある")
    proper_uniform = models.BooleanField(default=True, verbose_name="服装が正しい")

    verifier_name = models.CharField(max_length=100, verbose_name="確認者")

    unwell_during_work = models.BooleanField(default=False, verbose_name="作業中に体調不良はなかった")
    unwell_during_work_notes = models.CharField(max_length=255, blank=True, null=True, verbose_name="作業中体調不良備考")

    hand_washing_done = models.BooleanField(default=True, verbose_name="手洗いを実施した")

    supervisor_signature = models.CharField(max_length=100, verbose_name="所長または責任者のサイン")

    notes = models.TextField(blank=True, null=True, verbose_name="備考")

    def __str__(self):
        return f"{self.date} {self.employee.name} - 確認者: {self.verifier_name}"

    @property
    def day_of_week(self):
        days = ['月', '火', '水', '木', '金', '土', '日']
        return days[self.date.weekday()]


# Create your models here.
