"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/auth/simple-login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-8 max-w-sm w-full text-center space-y-6">
      <h1 className="text-xl font-semibold text-foreground">투자 지원 대시보드</h1>
      <p className="text-sm text-muted-foreground">
        접근하려면 비밀번호를 입력하세요.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm"
          autoFocus
          autoComplete="current-password"
        />
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "확인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <Suspense
        fallback={
          <div className="rounded-xl border border-border/60 bg-card p-8 max-w-sm w-full text-center text-muted-foreground">
            로딩 중…
          </div>
        }
      >
        <SignInForm />
      </Suspense>
    </main>
  );
}
