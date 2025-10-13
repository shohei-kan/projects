# backend/hygiene/services/record_status.py
from typing import Iterable, Tuple

def _item_val(item, key):
    return getattr(item, key, None)

def decorate_status_instance(rec, items_qs: Iterable = None) -> Tuple[bool, str, str, str]:
    """
    Record (+ items) から (is_off, work_type, status, status_jp) を返す。
    - work_type は 'off' / 'work'
    - status は 'off' | 'arrived' | 'left' | 'none'
    """
    items = list(items_qs) if items_qs is not None else list(getattr(rec, "items").all())

    explicit_off = any([
        getattr(rec, "is_off", None) is True,
        getattr(rec, "day_off", None) is True,  # 旧互換があれば
        str(getattr(rec, "status", "") or "").lower() == "off",
        str(getattr(rec, "work_type", "") or "").lower() == "off",
    ])

    wt = next((i for i in items if str(getattr(i, "category", "")) == "work_type"), None)
    wt_text = str(_item_val(wt, "comment") or _item_val(wt, "value") or "").lower() if wt else ""
    item_says_off = (wt_text == "off")

    has_start = bool(getattr(rec, "work_start_time", None))
    has_end   = bool(getattr(rec, "work_end_time", None))
    off_by_items_only = (not has_start and not has_end and len(items) > 0)

    is_off = bool(explicit_off or item_says_off or off_by_items_only)
    work_type = "off" if is_off else "work"

    status, status_jp = "none", "-"
    if is_off:
        status, status_jp = "off", "休み"
    elif has_start and has_end:
        status, status_jp = "left", "退勤入力済"
    elif has_start:
        status, status_jp = "arrived", "出勤入力済"

    return is_off, work_type, status, status_jp
