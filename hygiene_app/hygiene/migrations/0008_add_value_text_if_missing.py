# backend/hygiene/migrations/0008_add_value_text_if_missing.py
from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ("hygiene", "0007_record_is_off_record_work_type_recorditem_value_text_and_more"),
    ]

    operations = [
        # value_text カラム（NULL 可, 文字列50, index 付き）を「無ければ」追加
        migrations.RunSQL(
            sql="""
            ALTER TABLE hygiene_recorditem
            ADD COLUMN IF NOT EXISTS value_text varchar(50);

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relname = 'hygiene_recorditem_value_text_idx'
                      AND n.nspname = 'public'
                ) THEN
                    CREATE INDEX hygiene_recorditem_value_text_idx
                        ON hygiene_recorditem (value_text);
                END IF;
            END$$;
            """,
            reverse_sql="""
            -- 逆マイグレーション時は安全のため index -> column の順で削除（存在チェック付き）
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relname = 'hygiene_recorditem_value_text_idx'
                      AND n.nspname = 'public'
                ) THEN
                    DROP INDEX hygiene_recorditem_value_text_idx;
                END IF;
            END$$;

            ALTER TABLE hygiene_recorditem
            DROP COLUMN IF EXISTS value_text;
            """,
        ),
    ]
