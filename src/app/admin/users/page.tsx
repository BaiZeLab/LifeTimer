"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, RefreshCw, Copy, Check } from "lucide-react";
import { authClient } from "@/lib/auth-client";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  banned: boolean | null;
}

interface InviteCode {
  code: string;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  used_by_email: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, codesRes] = await Promise.all([
        authClient.admin.listUsers({ query: { limit: 100 } }),
        fetch("/api/admin/invite-codes"),
      ]);
      if (usersRes.error) throw new Error(usersRes.error.message ?? "Failed to load users");
      const rawUsers = (usersRes.data?.users ?? []) as unknown as Array<{
        id: string; name: string; email: string; role: string; createdAt: Date | string; banned?: boolean | null;
      }>;
      setUsers(rawUsers.map((u) => ({
        id: u.id, name: u.name, email: u.email, role: u.role,
        createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
        banned: u.banned ?? null,
      })));
      if (codesRes.ok) setInviteCodes(await codesRes.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function createInviteCode() {
    const res = await fetch("/api/admin/invite-codes", { method: "POST" });
    if (res.ok) loadData();
  }

  async function revokeInviteCode(code: string) {
    await fetch(`/api/admin/invite-codes?code=${encodeURIComponent(code)}`, { method: "DELETE" });
    loadData();
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function toggleBan(user: UserRow) {
    if (user.banned) {
      await authClient.admin.unbanUser({ userId: user.id });
    } else {
      await authClient.admin.banUser({ userId: user.id, banReason: "Banned by admin" });
    }
    loadData();
  }

  return (
    <div className="lt-admin-layout">
      {/* ── Header ── */}
      <div className="lt-admin-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/" style={{ color: "var(--lt-ink-3)", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={18} strokeWidth={1.8} />
          </Link>
          <h1 className="lt-admin-title">用户管理</h1>
        </div>
        <button
          onClick={loadData}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "7px 12px", border: "1px solid var(--lt-border)",
            borderRadius: "8px", background: "transparent",
            color: "var(--lt-ink-3)", fontSize: "0.8125rem", cursor: "pointer",
          }}
        >
          <RefreshCw size={13} strokeWidth={2} />
          刷新
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--lt-danger)", fontSize: "0.875rem", marginBottom: "16px" }}>{error}</p>
      )}

      {/* ── Users Table ── */}
      <section style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--lt-ink-2)", marginBottom: "12px" }}>
          账号列表
        </h2>
        {loading ? (
          <p style={{ color: "var(--lt-ink-3)", fontSize: "0.875rem" }}>加载中…</p>
        ) : (
          <div style={{ background: "var(--lt-surface)", borderRadius: "12px", border: "1px solid var(--lt-border-muted)", overflow: "hidden" }}>
            <table className="lt-admin-table">
              <thead>
                <tr>
                  <th>昵称</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>注册时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ color: "var(--lt-ink-1)", fontWeight: 500 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`lt-role-badge lt-role-badge--${u.role}`}>{u.role}</span>
                      {u.banned && (
                        <span style={{ marginLeft: "6px", fontSize: "0.75rem", color: "var(--lt-danger)" }}>已封禁</span>
                      )}
                    </td>
                    <td style={{ color: "var(--lt-ink-3)", fontSize: "0.8125rem" }}>
                      {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td>
                      {u.email !== "demo@lifetimer.local" && (
                        <button
                          onClick={() => toggleBan(u)}
                          style={{
                            padding: "3px 8px", border: "1px solid var(--lt-border)",
                            borderRadius: "5px", background: "transparent",
                            fontSize: "0.75rem", cursor: "pointer",
                            color: u.banned ? "var(--lt-ok)" : "var(--lt-danger)",
                          }}
                        >
                          {u.banned ? "解封" : "封禁"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Invite Codes ── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--lt-ink-2)" }}>邀请码</h2>
          <button
            onClick={createInviteCode}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 12px", border: "none",
              borderRadius: "8px", background: "var(--lt-ink-1)",
              color: "var(--lt-on-ink)", fontSize: "0.8125rem", cursor: "pointer",
            }}
          >
            <Plus size={13} strokeWidth={2.5} />
            生成邀请码
          </button>
        </div>

        <div style={{ background: "var(--lt-surface)", borderRadius: "12px", border: "1px solid var(--lt-border-muted)", overflow: "hidden" }}>
          {inviteCodes.length === 0 ? (
            <p style={{ padding: "20px 16px", color: "var(--lt-ink-3)", fontSize: "0.875rem", textAlign: "center" }}>
              暂无邀请码，点击「生成邀请码」创建
            </p>
          ) : (
            <table className="lt-admin-table">
              <thead>
                <tr>
                  <th>邀请码</th>
                  <th>创建时间</th>
                  <th>有效期</th>
                  <th>使用情况</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {inviteCodes.map((c) => (
                  <tr key={c.code}>
                    <td>
                      <span className="lt-invite-code-badge">{c.code}</span>
                    </td>
                    <td style={{ color: "var(--lt-ink-3)", fontSize: "0.8125rem" }}>
                      {new Date(c.created_at).toLocaleDateString("zh-CN")}
                    </td>
                    <td style={{ color: "var(--lt-ink-3)", fontSize: "0.8125rem" }}>
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString("zh-CN") : "永久"}
                    </td>
                    <td style={{ fontSize: "0.8125rem" }}>
                      {c.used_by_email ? (
                        <span style={{ color: "var(--lt-ink-3)" }}>已使用 · {c.used_by_email}</span>
                      ) : (
                        <span style={{ color: "var(--lt-ok)", fontWeight: 500 }}>未使用</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {!c.used_by_email && (
                          <>
                            <button
                              onClick={() => copyCode(c.code)}
                              title="复制"
                              style={{
                                padding: "3px 8px", border: "1px solid var(--lt-border)",
                                borderRadius: "5px", background: "transparent",
                                fontSize: "0.75rem", cursor: "pointer",
                                color: "var(--lt-ink-3)",
                                display: "flex", alignItems: "center", gap: "3px",
                              }}
                            >
                              {copiedCode === c.code
                                ? <><Check size={11} strokeWidth={2.5} /> 已复制</>
                                : <><Copy size={11} strokeWidth={1.8} /> 复制</>
                              }
                            </button>
                            <button
                              onClick={() => revokeInviteCode(c.code)}
                              title="撤销"
                              style={{
                                padding: "3px 8px", border: "1px solid var(--lt-border)",
                                borderRadius: "5px", background: "transparent",
                                fontSize: "0.75rem", cursor: "pointer",
                                color: "var(--lt-danger)",
                                display: "flex", alignItems: "center", gap: "3px",
                              }}
                            >
                              <Trash2 size={11} strokeWidth={1.8} />
                              撤销
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
