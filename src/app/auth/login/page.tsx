"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "登录失败");
      } else {
        router.replace(next);
        router.refresh();
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lt-auth-layout">
      <div className="lt-auth-card">
        <div className="lt-auth-header">
          <h1 className="lt-auth-title">Life Timer</h1>
          <p className="lt-auth-subtitle">登录以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="lt-auth-form">
          {error && <p className="lt-auth-error">{error}</p>}

          <div className="lt-auth-field">
            <label htmlFor="email" className="lt-auth-label">邮箱</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="lt-auth-input"
              placeholder="your@email.com"
            />
          </div>

          <div className="lt-auth-field">
            <label htmlFor="password" className="lt-auth-label">密码</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="lt-auth-input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="lt-auth-submit">
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="lt-auth-footer">
          有邀请码？<Link href="/auth/register" className="lt-auth-link">注册账号</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="lt-auth-layout">
        <div className="lt-auth-card">
          <div className="lt-auth-header">
            <h1 className="lt-auth-title">Life Timer</h1>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
