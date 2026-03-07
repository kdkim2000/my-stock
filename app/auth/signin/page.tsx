"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="rounded-xl border border-border/60 bg-card p-8 max-w-sm w-full text-center space-y-6">
        <h1 className="text-xl font-semibold text-foreground">투자 지원 대시보드</h1>
        <p className="text-sm text-muted-foreground">
          접근하려면 로그인해 주세요. 허용된 계정만 이용할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Google로 로그인
        </button>
      </div>
    </main>
  );
}
