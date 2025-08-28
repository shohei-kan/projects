/// <reference types="vite/client" />

// 必要な環境変数だけ型定義（任意で増やしてOK）
interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_USE_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
