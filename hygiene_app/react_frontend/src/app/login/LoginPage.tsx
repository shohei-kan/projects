"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { mockBranches } from "@/data/mockBranches"; // モックデータ

export default function LoginForm() {
  const [officeCode, setOfficeCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!officeCode || !password) {
      setError("営業所コードとパスワードを入力してください。");
      return;
    }

    // ✅ モックデータから営業所を検索
    const branch = mockBranches.find((b) => b.code === officeCode);

    if (!branch) {
      setError("営業所コードが見つかりません");
      return;
    }

    if (branch.password !== password) {
      setError("パスワードが間違っています");
      return;
    }

    // 認証成功
    setError("");
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("loginDate", new Date().toDateString());
    localStorage.setItem("branchCode", branch.code);

    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl text-gray-800">営業所ログイン</CardTitle>
          <div className="w-16 h-1 bg-blue-500 mx-auto mt-2 rounded-full"></div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <span className="text-gray-700">営業所コード</span>
              <Input
                id="officeCode"
                type="text"
                placeholder="例：AB1234"
                value={officeCode}
                onChange={(e) => setOfficeCode(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <span className="text-gray-700">パスワード</span>
              <Input
                id="password"
                type="password"
                placeholder="例：1234"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full h-12 bg-blue-600 text-white">
              ログイン
            </Button>
          </form>

          <div className="text-center pt-4">
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
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></span>
                      営業所コードやパスワードに間違いがないかご確認ください。
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></span>
                      パスワードは営業所コードの「数字4桁部分」です（例：AB1234 → 1234）。
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></span>
                      それでもログインできない場合は、本部管理者へご連絡ください。
                    </li>
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
