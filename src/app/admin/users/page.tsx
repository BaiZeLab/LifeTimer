"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, RefreshCw, Copy, Check, Bell, Send, Users, User, Monitor } from "lucide-react";
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

interface SubStat {
  user_id: string;
  name: string;
  email: string;
  sub_count: number;
}

interface BroadcastResult {
  sent: number;
  failed: number;
  staleRemoved: number;
  total: number;
}

interface PwaDiagRow {
  id: number;
  user_agent: string | null;
  is_ios: boolean | null;
  ios_version: string | null;
  is_android: boolean | null;
  is_standalone: boolean | null;
  is_https: boolean | null;
  sw_supported: boolean | null;
  sw_registered: boolean | null;
  notif_supported: boolean | null;
  notif_perm: string | null;
  push_supported: boolean | null;
  manifest_ok: boolean | null;
  icon192_ok: boolean | null;
  apple_icon_ok: boolean | null;
  apple_icon_mime: string | null;
  apple_icon_url: string | null;
  submitted_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [subStats, setSubStats] = useState<SubStat[]>([]);
  const [pwaDiags, setPwaDiags] = useState<PwaDiagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Push broadcast state
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushUrl, setPushUrl] = useState("/");
  const [pushTarget, setPushTarget] = useState<"all" | string>("all");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<BroadcastResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, codesRes, subsRes, diagsRes] = await Promise.all([
        authClient.admin.listUsers({ query: { limit: 100 } }),
        fetch("/api/admin/invite-codes"),
        fetch("/api/admin/push"),
        fetch("/api/pwa-check"),
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
      if (subsRes.ok) setSubStats(await subsRes.json());
      if (diagsRes.ok) {
        const d = await diagsRes.json() as { rows: PwaDiagRow[] };
        setPwaDiags(d.rows ?? []);
      }
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

  async function sendBroadcast() {
    if (!pushTitle.trim() || !pushBody.trim()) return;
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pushTitle.trim(),
          body:  pushBody.trim(),
          url:   pushUrl.trim() || "/",
          userIds: pushTarget === "all" ? undefined : [pushTarget],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "发送失败");
      } else {
        setSendResult(data as BroadcastResult);
        setPushTitle("");
        setPushBody("");
      }
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
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

      {/* ── Push Broadcast ── */}
      <section style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Bell size={15} strokeWidth={1.8} style={{ color: "var(--lt-ink-3)" }} />
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--lt-ink-2)" }}>
            发送推送通知
          </h2>
          {subStats.length > 0 && (
            <span style={{
              fontSize: "0.75rem", color: "var(--lt-ink-4)",
              background: "var(--lt-surface-2)", borderRadius: "9999px",
              padding: "2px 8px",
            }}>
              {subStats.reduce((s, r) => s + r.sub_count, 0)} 个订阅 · {subStats.length} 人
            </span>
          )}
        </div>

        <div style={{
          background: "var(--lt-surface)", borderRadius: "12px",
          border: "1px solid var(--lt-border-muted)", padding: "20px",
          display: "flex", flexDirection: "column", gap: "14px",
        }}>
          {/* Target selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--lt-ink-2)" }}>
              发送对象
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => setPushTarget("all")}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "6px 12px", borderRadius: "8px",
                  border: `1.5px solid ${pushTarget === "all" ? "var(--lt-ink-1)" : "var(--lt-border)"}`,
                  background: pushTarget === "all" ? "var(--lt-ink-1)" : "transparent",
                  color: pushTarget === "all" ? "var(--lt-on-ink)" : "var(--lt-ink-3)",
                  fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                  transition: "all 150ms ease-out",
                }}
              >
                <Users size={13} strokeWidth={2} />
                全部用户 ({subStats.reduce((s, r) => s + r.sub_count, 0)} 订阅)
              </button>
              {subStats.map((stat) => (
                <button
                  key={stat.user_id}
                  onClick={() => setPushTarget(stat.user_id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "6px 12px", borderRadius: "8px",
                    border: `1.5px solid ${pushTarget === stat.user_id ? "var(--lt-ink-1)" : "var(--lt-border)"}`,
                    background: pushTarget === stat.user_id ? "var(--lt-ink-1)" : "transparent",
                    color: pushTarget === stat.user_id ? "var(--lt-on-ink)" : "var(--lt-ink-3)",
                    fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                    transition: "all 150ms ease-out",
                  }}
                >
                  <User size={13} strokeWidth={2} />
                  {stat.name}
                  <span style={{
                    fontSize: "0.7rem", opacity: 0.7,
                    background: pushTarget === stat.user_id
                      ? "oklch(100% 0 0 / 0.15)"
                      : "var(--lt-surface-2)",
                    padding: "1px 5px", borderRadius: "9999px",
                  }}>
                    {stat.sub_count}
                  </span>
                </button>
              ))}
            </div>
            {subStats.length === 0 && !loading && (
              <p style={{ fontSize: "0.8125rem", color: "var(--lt-ink-4)", fontStyle: "italic" }}>
                暂无用户订阅推送。用户需在主页点击铃铛图标授权后才会出现。
              </p>
            )}
          </div>

          {/* Title */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--lt-ink-2)" }}>
              标题
            </label>
            <input
              className="lt-auth-input"
              value={pushTitle}
              onChange={(e) => setPushTitle(e.target.value)}
              placeholder="如：Life Timer 公告"
              maxLength={64}
            />
          </div>

          {/* Body */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--lt-ink-2)" }}>
              内容
            </label>
            <textarea
              className="lt-textarea"
              value={pushBody}
              onChange={(e) => setPushBody(e.target.value)}
              placeholder="通知正文，建议简短（80 字以内）"
              maxLength={200}
              style={{ minHeight: "72px", fontSize: "0.9375rem" }}
            />
            <div style={{ fontSize: "0.75rem", color: "var(--lt-ink-4)", textAlign: "right" }}>
              {pushBody.length} / 200
            </div>
          </div>

          {/* URL */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--lt-ink-3)" }}>
              点击跳转地址（可选，默认 /）
            </label>
            <input
              className="lt-auth-input"
              value={pushUrl}
              onChange={(e) => setPushUrl(e.target.value)}
              placeholder="/"
            />
          </div>

          {/* Result / Error feedback */}
          {sendResult && (
            <div style={{
              padding: "10px 14px", borderRadius: "8px",
              background: "oklch(from var(--lt-ok) l c h / 0.10)",
              border: "1px solid oklch(from var(--lt-ok) l c h / 0.30)",
              fontSize: "0.875rem", color: "var(--lt-ink-2)",
              display: "flex", gap: "16px",
            }}>
              <span>✓ 成功发送 <strong>{sendResult.sent}</strong></span>
              {sendResult.failed > 0 && <span style={{ color: "var(--lt-danger)" }}>失败 {sendResult.failed}</span>}
              {sendResult.staleRemoved > 0 && <span style={{ color: "var(--lt-ink-4)" }}>清理过期订阅 {sendResult.staleRemoved}</span>}
            </div>
          )}
          {sendError && (
            <div style={{
              padding: "10px 14px", borderRadius: "8px",
              background: "var(--lt-danger-hover-bg)",
              fontSize: "0.875rem", color: "var(--lt-danger)",
            }}>
              {sendError}
            </div>
          )}

          {/* Send button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={sendBroadcast}
              disabled={sending || !pushTitle.trim() || !pushBody.trim() || subStats.length === 0}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "9px 20px", border: "none", borderRadius: "10px",
                background: "var(--lt-ink-1)", color: "var(--lt-on-ink)",
                fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
                opacity: (sending || !pushTitle.trim() || !pushBody.trim() || subStats.length === 0) ? 0.45 : 1,
                transition: "opacity 150ms ease-out",
              }}
            >
              <Send size={14} strokeWidth={2} />
              {sending ? "发送中…" : "立即推送"}
            </button>
          </div>
        </div>
      </section>

      {/* ── PWA Diagnostics ── */}
      <section style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Monitor size={15} strokeWidth={1.8} style={{ color: "var(--lt-ink-3)" }} />
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--lt-ink-2)" }}>
            PWA 诊断日志
          </h2>
          <a
            href="/pwa-check"
            target="_blank"
            rel="noopener"
            style={{
              fontSize: "0.75rem", color: "var(--lt-ink-4)",
              background: "var(--lt-surface-2)", borderRadius: "9999px",
              padding: "2px 8px", textDecoration: "none",
            }}
          >
            诊断页面 ↗
          </a>
        </div>

        {pwaDiags.length === 0 ? (
          <div style={{
            background: "var(--lt-surface)", borderRadius: "12px",
            border: "1px solid var(--lt-border-muted)",
            padding: "20px 16px", color: "var(--lt-ink-3)",
            fontSize: "0.875rem", textAlign: "center",
          }}>
            暂无诊断记录。让用户访问{" "}
            <a href="/pwa-check" target="_blank" rel="noopener" style={{ color: "var(--lt-ink-2)", textDecoration: "underline" }}>
              /pwa-check
            </a>{" "}
            并点击"发送报告给管理员"。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pwaDiags.map((d) => {
              const issues: string[] = [];
              if (!d.is_https) issues.push("非 HTTPS");
              if (!d.manifest_ok) issues.push("manifest 失败");
              if (!d.icon192_ok) issues.push("icon-192 失败");
              if (!d.apple_icon_ok)
                issues.push(
                  d.apple_icon_mime?.includes("html")
                    ? `apple-icon 重定向到登录页 (CF缓存307)`
                    : "apple-icon 失败"
                );
              if (!d.sw_registered && d.sw_supported) issues.push("SW 未注册");
              if (d.is_ios && !d.is_standalone) issues.push("非独立模式");
              if (d.is_ios && !d.push_supported) issues.push("iOS Push 不可用");

              const ok = (v: boolean | null) =>
                v === null ? "?" : v ? "✅" : "❌";

              const platform = d.is_ios
                ? `iOS ${d.ios_version ?? ""}`
                : d.is_android
                ? "Android"
                : "Desktop";

              return (
                <div
                  key={d.id}
                  style={{
                    background: "var(--lt-surface)", borderRadius: "12px",
                    border: `1px solid ${issues.length > 0 ? "oklch(from var(--lt-danger) l c h / 0.30)" : "var(--lt-border-muted)"}`,
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--lt-ink-2)" }}>
                        {platform}
                      </span>
                      {d.is_standalone && (
                        <span style={{ fontSize: "0.7rem", color: "var(--lt-ok)", background: "oklch(from var(--lt-ok) l c h / 0.10)", padding: "1px 6px", borderRadius: "9999px" }}>
                          独立模式
                        </span>
                      )}
                      {issues.length === 0 && (
                        <span style={{ fontSize: "0.7rem", color: "var(--lt-ok)" }}>全部通过</span>
                      )}
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--lt-ink-4)", whiteSpace: "nowrap" }}>
                      {new Date(d.submitted_at).toLocaleString("zh-CN")}
                    </span>
                  </div>

                  {issues.length > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      {issues.map((issue, i) => (
                        <span
                          key={i}
                          style={{
                            display: "inline-block", marginRight: "6px", marginBottom: "4px",
                            fontSize: "0.75rem", color: "var(--lt-danger)",
                            background: "var(--lt-danger-hover-bg)",
                            padding: "2px 7px", borderRadius: "9999px",
                          }}
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--lt-ink-3)" }}>
                    <span>manifest {ok(d.manifest_ok)}</span>
                    <span>icon-192 {ok(d.icon192_ok)}</span>
                    <span>apple-icon {ok(d.apple_icon_ok)}</span>
                    <span>SW {ok(d.sw_registered)}</span>
                    <span>Push {ok(d.push_supported)}</span>
                    <span>通知 {d.notif_perm ?? "?"}</span>
                  </div>

                  {d.user_agent && (
                    <p style={{
                      marginTop: "6px", fontSize: "0.7rem", color: "var(--lt-ink-4)",
                      wordBreak: "break-all",
                    }}>
                      {d.user_agent.slice(0, 120)}{d.user_agent.length > 120 ? "…" : ""}
                    </p>
                  )}
                </div>
              );
            })}
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
