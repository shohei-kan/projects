#!/usr/bin/env sh
set -e

# DB待機
echo "Waiting for Postgres at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
until nc -z "${POSTGRES_HOST:-db}" "${POSTGRES_PORT:-5432}"; do
  sleep 1
done
echo "Postgres is up."

# マイグレーション & 起動
python manage.py migrate

# 開発用ヘルスチェック: 無ければ urls に追加
if ! grep -q "healthz" config/urls.py; then
  sed -i 's/from django.urls import path/from django.urls import path\nfrom django.http import JsonResponse/g' config/urls.py
  sed -i 's/urlpatterns = \[/def healthz(_): return JsonResponse({"status":"ok"})\n\nurlpatterns = [\n    path("healthz", healthz),/' config/urls.py
fi

echo "Starting Django dev server..."
python manage.py runserver 0.0.0.0:8000
