# hygiene/migrations/0009_remove_record_status_remove_record_status_jp_and_more.py
from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('hygiene', '0008_add_value_text_if_missing'),  # ← 依存もこの名前で統一
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DO $$
            BEGIN
              -- status
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='hygiene_record' AND column_name='status'
              ) THEN
                ALTER TABLE hygiene_record DROP COLUMN status;
              END IF;

              -- status_jp
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='hygiene_record' AND column_name='status_jp'
              ) THEN
                ALTER TABLE hygiene_record DROP COLUMN status_jp;
              END IF;
            END$$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),

        # ここに AlterField 群（employee.code など）があるならそのまま残す
        # migrations.AlterField(...),
    ]
