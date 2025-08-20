"use client";

import React, { JSX, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";

import { TODAY_STR } from "@/data/mockDate";
import { mockBranches } from "@/data/mockBranches"; // 必要なら "@/data" のバレル経由に変更OK
import { mockAdmins } from "@/data/mockAdmins";

/* =========================
   型（このファイル内で完結）
   ========================= */
type UserRole = "hq_admin" | "branch_manager" | "employee";
type SessionUser =
  | { role: "hq_admin"; userId: string; displayName: string; branchCode: null }
  | { role: "branch_manager" | "employee"; userId: string; displayName: string; branchCode: string };

type SessionPayload = {
  isLoggedIn: true;
  loginDate: string; // YYYY-MM-DD
  user: SessionUser;
};

function saveSession(payload: SessionPayload) {
  localStorage.setItem("session", JSON.stringify(payload));
  // レガシーキーが残っていると誤作動する可能性があるため念のため消す
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("loginDate");
  localStorage.removeItem("role");
  localStorage.removeItem("branchCode");
}

/* =========================
   バリデーション Schema
   ========================= */
const branchSchema = z.object({
  role: z.literal("branch"),
  officeCode: z
    .string()
    .trim()
    .min(1, "営業所コードを入力してください。")
    .regex(/^[A-Za-z]{2}\d{4}$/, "英字2文字＋数字4桁で入力してください（例：YK1234）。"),
  password: z
    .string()
    .trim()
    .min(1, "パスワードを入力してください。")
    .regex(/^\d{4}$/, "数字4桁で入力してください。"),
});

const hqSchema = z.object({
  role: z.literal("hq_admin"),
  adminId: z
    .string()
    .trim()
    .min(1, "IDを入力してください。")
    .regex(/^\d{6}$/, "数字6桁で入力してください。"),
  adminPass: z
    .string()
    .trim()
    .min(1, "パスワードを入力してください。")
    .regex(/^\d{6}$/, "数字6桁で入力してください。"),
});

const schema = z.discriminatedUnion("role", [branchSchema, hqSchema]);
type FormValues = z.infer<typeof schema>;

/* =========================
   コンポーネント
   ========================= */
export default function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    watch,
    setValue,
  } = useForm<FormValues>({
    mode: "onChange",
    resolver: zodResolver(schema),
    defaultValues: { role: "branch" } as any,
  });

  const role = watch("role");
  const officeCode = role === "branch" ? (watch("officeCode") as string | undefined) : undefined;

  // 営業所コードは常に大文字へ補正
  useMemo(() => {
    if (role !== "branch") return;
    if (!officeCode) return;
    const upper = officeCode.toUpperCase();
    if (upper !== officeCode) setValue("officeCode" as any, upper, { shouldValidate: true });
  }, [officeCode, role, setValue]);

  const onSubmit = async (values: FormValues) => {
    setServerError("");

    // 営業所ログイン
    if (values.role === "branch") {
      const branch = mockBranches.find((b) => b.code === values.officeCode);
      if (!branch) {
        setServerError("営業所コードが見つかりません。");
        return;
      }
      if (branch.password !== values.password) {
        setServerError("パスワードが間違っています。");
        return;
      }

      const payload: SessionPayload = {
        isLoggedIn: true,
        loginDate: new Date(TODAY_STR).toISOString().slice(0, 10),
        user: {
          role: "branch_manager", // 社内運用に合わせて "employee" に変更可
          userId: branch.code,    // 共有アカウントなら code をID代用
          displayName: (branch as any).name ?? branch.code,
          branchCode: branch.code,
        },
      };
      saveSession(payload);
      navigate("/dashboard", { replace: true });
      return;
    }

    // 本部ログイン
    if (values.role === "hq_admin") {
      const admin = mockAdmins.find((a) => a.id === values.adminId);
      if (!admin) {
        setServerError("IDが見つかりません。");
        return;
      }
      if (admin.password !== values.adminPass) {
        setServerError("パスワードが間違っています。");
        return;
      }

      const payload: SessionPayload = {
        isLoggedIn: true,
        loginDate: new Date(TODAY_STR).toISOString().slice(0, 10),
        user: {
          role: "hq_admin",
          userId: admin.id,
          displayName: admin.name,
          branchCode: null, // 本部は所属なし
        },
      };
      saveSession(payload);
      navigate("/admin", { replace: true });
      return;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl text-gray-800">ログイン</CardTitle>
          <div className="w-16 h-1 bg-blue-500 mx-auto mt-2 rounded-full" />
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ロール切替（ラジオ） */}
          <div className="flex items-center justify-center gap-6">
            <label className="inline-flex items-center gap-2">
              <input type="radio" value="branch" {...register("role")} defaultChecked />
              <span>営業所</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" value="hq_admin" {...register("role")} />
              <span>本部管理者</span>
            </label>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* 営業所ログインフォーム */}
            {role === "branch" && (
              <>
                <div className="space-y-2">
                  <label htmlFor="officeCode" className="text-gray-700">
                    営業所コード
                  </label>
                  <Input
                    id="officeCode"
                    type="text"
                    placeholder="例：YK1234"
                    autoComplete="username"
                    aria-invalid={!!(errors as any).officeCode || undefined}
                    aria-describedby={(errors as any).officeCode ? "officeCode-error" : undefined}
                    {...register("officeCode")}
                  />
                  {(errors as any).officeCode && (
                    <p id="officeCode-error" className="text-sm text-red-600">
                      {(errors as any).officeCode.message as string}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-gray-700">
                    パスワード（数字4桁）
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="例：1234"
                    autoComplete="current-password"
                    inputMode="numeric"
                    aria-invalid={!!(errors as any).password || undefined}
                    aria-describedby={(errors as any).password ? "password-error" : undefined}
                    {...register("password")}
                  />
                  {(errors as any).password && (
                    <p id="password-error" className="text-sm text-red-600">
                      {(errors as any).password.message as string}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* 本部管理者ログインフォーム */}
            {role === "hq_admin" && (
              <>
                <div className="space-y-2">
                  <label htmlFor="adminId" className="text-gray-700">
                    管理者ID（数字6桁）
                  </label>
                  <Input
                    id="adminId"
                    type="text"
                    placeholder="例：123456"
                    autoComplete="username"
                    inputMode="numeric"
                    aria-invalid={!!(errors as any).adminId || undefined}
                    aria-describedby={(errors as any).adminId ? "adminId-error" : undefined}
                    {...register("adminId")}
                  />
                  {(errors as any).adminId && (
                    <p id="adminId-error" className="text-sm text-red-600">
                      {(errors as any).adminId.message as string}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="adminPass" className="text-gray-700">
                    パスワード（数字6桁）
                  </label>
                  <Input
                    id="adminPass"
                    type="password"
                    placeholder="例：654321"
                    autoComplete="current-password"
                    inputMode="numeric"
                    aria-invalid={!!(errors as any).adminPass || undefined}
                    aria-describedby={(errors as any).adminPass ? "adminPass-error" : undefined}
                    {...register("adminPass")}
                  />
                  {(errors as any).adminPass && (
                    <p id="adminPass-error" className="text-sm text-red-600">
                      {(errors as any).adminPass.message as string}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* 認証失敗などサーバー系のエラー */}
            {serverError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full h-12 bg-blue-500 text-gray-900" disabled={!isValid || isSubmitting}>
              {isSubmitting ? "処理中..." : "ログイン"}
            </Button>
          </form>

          {/* ヘルプダイアログ */}
          <div className="text-center pt-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <button className="text-sm text-gray-500 hover:text-blue-600 underline">
                  ログインできない場合はこちら
                </button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md bg-white text-gray-800 shadow-lg rounded-xl">
                <DialogHeader>
                  <DialogTitle>ログインできない場合の対処方法</DialogTitle>
                  <DialogDescription className="sr-only">
                    ログインエラー対処方法の説明
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                  <ul className="space-y-3 text-gray-700">
                    {role === "branch" ? (
                      <>
                        <li className="flex items-start">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3" />
                          営業所コードやパスワードに誤りがないかご確認ください。
                        </li>
                        <li className="flex items-start">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3" />
                          パスワードは営業所コードの「数字4桁部分」です（例：AB1234 → 1234）。
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-start">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3" />
                          本部のID/パスワードはいずれも**数字6桁**です（先頭ゼロも有効）。
                        </li>
                        <li className="flex items-start">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3" />
                          それでもログインできない場合はシステム管理者へご連絡ください。
                        </li>
                      </>
                    )}
                  </ul>

                  <div className="pt-4">
                    <Button onClick={() => setIsDialogOpen(false)} className="w-full bg-gray-100">
                      閉じる
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
