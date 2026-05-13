"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, inviteCode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "注册失败");
      } else {
        router.replace("/");
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
          <p className="lt-auth-subtitle">创建账号</p>
        </div>

        <form onSubmit={handleSubmit} className="lt-auth-form">
          {error && <p className="lt-auth-error">{error}</p>}

          <div className="lt-auth-field">
            <label htmlFor="name" className="lt-auth-label">昵称</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="lt-auth-input"
              placeholder="你的名字"
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="lt-auth-input"
              placeholder="至少 8 位"
            />
          </div>

          <div className="lt-auth-field">
            <label htmlFor="invite-code" className="lt-auth-label">邀请码</label>
            <input
              id="invite-code"
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="lt-auth-input lt-auth-input--mono"
              placeholder="XXXXXXXXXXXXXX"
              maxLength={20}
            />
          </div>

          <button type="submit" disabled={loading} className="lt-auth-submit">
            {loading ? "注册中…" : "注册"}
          </button>
        </form>

        <p className="lt-auth-footer">
          已有账号？<Link href="/auth/login" className="lt-auth-link">登录</Link>
        </p>
      </div>
    </div>
  );
}
