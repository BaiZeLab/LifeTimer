"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 409) {
          // Already initialized — redirect to login
          router.replace("/auth/login");
          return;
        }
        setError(data?.error ?? "初始化失败，请稍后重试");
      } else {
        // Auto-logged in via set-cookie; go to home
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <ShieldCheck size={22} strokeWidth={1.8} style={{ color: "var(--lt-ink-2)" }} />
            <h1 className="lt-auth-title">初始化系统</h1>
          </div>
          <p className="lt-auth-subtitle">创建管理员账号以开始使用 Life Timer</p>
          <p style={{
            marginTop: "10px", fontSize: "0.8rem", color: "var(--lt-ink-3)",
            background: "var(--lt-surface-2)", borderRadius: "6px", padding: "8px 10px",
            lineHeight: 1.5,
          }}>
            此页面仅在首次启动时可用，创建完成后自动关闭。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="lt-auth-form">
          {error && <p className="lt-auth-error">{error}</p>}

          <div className="lt-auth-field">
            <label htmlFor="name" className="lt-auth-label">管理员昵称</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="lt-auth-input"
              placeholder="Admin"
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
              placeholder="admin@example.com"
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
            <label htmlFor="confirm" className="lt-auth-label">确认密码</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="lt-auth-input"
              placeholder="再次输入密码"
            />
          </div>

          <button type="submit" disabled={loading} className="lt-auth-submit">
            {loading ? "初始化中…" : "创建管理员账号"}
          </button>
        </form>
      </div>
    </div>
  );
}
