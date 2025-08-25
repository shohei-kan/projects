from pathlib import Path
import os
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# ── 基本設定（環境変数優先）
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-change-this")
DEBUG = os.getenv("DJANGO_DEBUG", "1").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")

# ── アプリ
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # 外部
    "rest_framework",
    "corsheaders",

    # 自作アプリ
    "hygiene",
]

# ── ミドルウェア（CORS は CommonMiddleware より前に）
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ── DB（Docker の .env を参照：db(Postgres)へ）
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "hygiene"),
        "USER": os.getenv("POSTGRES_USER", "hygiene"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "hygiene"),
        "HOST": os.getenv("POSTGRES_HOST", "db"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

# ── 認証ポリシー
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── i18n
LANGUAGE_CODE = "ja"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "Asia/Tokyo")
USE_I18N = True
USE_TZ = True

# ── 静的ファイル
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # 本番collectstatic用（開発では未使用でもOK）

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── REST / JWT
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
}

# ── CORS/CSRF（Vite: http://localhost:5173）
CORS_ALLOWED_ORIGINS = [
    o for o in os.getenv("DJANGO_CORS_ORIGINS", "http://localhost:5173").split(",") if o
]
CSRF_TRUSTED_ORIGINS = [
    o for o in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:5173").split(",") if o
]
