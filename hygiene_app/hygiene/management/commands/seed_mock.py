from django.core.management.base import BaseCommand
from django.db import transaction
from hygiene.models import Office, Employee

BRANCHES = [
    {"code": "KM3076", "name": "横浜市立馬場小学校", "management_pin": "0225"},
    {"code": "KM5678", "name": "横浜英和学院",     "management_pin": "0225"},
    {"code": "TK9012", "name": "横浜市立緑小学校", "management_pin": "0225"},
]

EMPLOYEES = [
    {"code": "100001", "name": "森 真樹",   "branchCode": "KM3076"},
    {"code": "100002", "name": "菅野 祥平", "branchCode": "KM3076"},
    {"code": "100003", "name": "池田 菜乃", "branchCode": "KM3076"},
    {"code": "100004", "name": "山田 次郎", "branchCode": "KM3076"},
    {"code": "100005", "name": "鈴木 美咲", "branchCode": "KM3076"},
    {"code": "200001", "name": "関 昌昭",   "branchCode": "KM5678"},
    {"code": "200002", "name": "飯田 竜平", "branchCode": "KM5678"},
    {"code": "200003", "name": "渡辺 恵子", "branchCode": "KM5678"},
    {"code": "200004", "name": "松本 大樹", "branchCode": "KM5678"},
    {"code": "200005", "name": "中村 さゆり","branchCode": "KM5678"},
    {"code": "300001", "name": "本部 太郎", "branchCode": "TK9012"},
    {"code": "300002", "name": "高木 真樹", "branchCode": "TK9012"},
    {"code": "300003", "name": "大野 未来", "branchCode": "TK9012"},
    {"code": "300004", "name": "清水 健太", "branchCode": "TK9012"},
    {"code": "300005", "name": "西村 純",   "branchCode": "TK9012"},
]

class Command(BaseCommand):
    help = "Seed Offices and Employees from mock data (idempotent)"

    @transaction.atomic
    def handle(self, *args, **opts):
        oC=oU=eC=eU=0
        for b in BRANCHES:
            _, created = Office.objects.update_or_create(
                code=b["code"],
                defaults={"name": b["name"], "management_pin": b.get("management_pin","")}
            )
            oC += int(created); oU += int(not created)

        offices = {o.code:o for o in Office.objects.filter(code__in=[b["code"] for b in BRANCHES])}
        missing=[]
        for e in EMPLOYEES:
            off = offices.get(e["branchCode"])
            if not off: missing.append(e["branchCode"]); continue
            _, created = Employee.objects.update_or_create(
                code=e["code"],
                defaults={"name": e["name"], "office": off}
            )
            eC += int(created); eU += int(not created)

        if missing: self.stdout.write(self.style.WARNING(f"Missing offices for: {sorted(set(missing))}"))
        self.stdout.write(self.style.SUCCESS(f"Seed done: Offices C{oC}/U{oU}  Employees C{eC}/U{eU}"))
