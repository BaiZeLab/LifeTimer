"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, Send, Copy, Check, RefreshCw } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DiagResult {
  userAgent: string;
  isIos: boolean;
  iosVersion: string;
  isAndroid: boolean;
  isStandalone: boolean;
  isHttps: boolean;
  swSupported: boolean;
  swRegistered: boolean;
  notifSupported: boolean;
  notifPerm: string;
  pushSupported: boolean;
  manifestOk: boolean;
  manifestMime: string;
  icon192Ok: boolean;
  appleIconOk: boolean;
  appleIconMime: string;
  appleIconUrl: string;
  timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIosVersion(ua: string): string {
  const m = ua.match(/OS (\d+)[_\.](\d+)/);
  return m ? `${m[1]}.${m[2]}` : "unknown";
}

async function fetchResourceCheck(url: string): Promise<{ ok: boolean; mime: string; finalUrl: string }> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const mime = res.headers.get("content-type") ?? "";
    return { ok: res.ok, mime, finalUrl: res.url };
  } catch {
    return { ok: false, mime: "", finalUrl: url };
  }
}

async function runDiagnostics(): Promise<DiagResult> {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) && !(window as { MSStream?: unknown }).MSStream;
  const isAndroid = /android/i.test(ua);
  const isStandalone =
    (navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  const isHttps = location.protocol === "https:" || location.hostname === "localhost";

  const swSupported = "serviceWorker" in navigator;
  let swRegistered = false;
  if (swSupported) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      swRegistered = regs.length > 0;
    } catch {
      swRegistered = false;
    }
  }

  const notifSupported = "Notification" in window;
  const notifPerm = notifSupported ? Notification.permission : "unsupported";
  const pushSupported = "PushManager" in window;

  const [manifestRes, icon192Res, appleIconRes] = await Promise.all([
    fetchResourceCheck("/manifest.json"),
    fetchResourceCheck("/icons/icon-192.png"),
    fetchResourceCheck("/icons/apple-touch-icon.png"),
  ]);

  const manifestOk = manifestRes.ok && manifestRes.mime.includes("json");
  const icon192Ok = icon192Res.ok && icon192Res.mime.startsWith("image/");
  // If Cloudflare cached a 307 redirect, fetch() follows it and ends up at /auth/login (HTML)
  const appleIconOk = appleIconRes.ok && appleIconRes.mime.startsWith("image/");

  return {
    userAgent: ua,
    isIos,
    iosVersion: isIos ? getIosVersion(ua) : "",
    isAndroid,
    isStandalone,
    isHttps,
    swSupported,
    swRegistered,
    notifSupported,
    notifPerm,
    pushSupported,
    manifestOk,
    manifestMime: manifestRes.mime,
    icon192Ok,
    appleIconOk,
    appleIconMime: appleIconRes.mime,
    appleIconUrl: appleIconRes.finalUrl,
    timestamp: new Date().toISOString(),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({
  label,
  ok,
  value,
  warn,
}: {
  label: string;
  ok: boolean | null;
  value?: string;
  warn?: boolean;
}) {
  const Icon =
    ok === null ? AlertCircle : ok ? CheckCircle : warn ? AlertCircle : XCircle;
  const color =
    ok === null
      ? "var(--lt-ink-4)"
      : ok
      ? "var(--lt-ok-deep)"
      : warn
      ? "var(--lt-warn-deep)"
      : "var(--lt-danger)";

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "10px",
      padding: "9px 0", borderBottom: "1px solid var(--lt-border-muted)",
    }}>
      <Icon size={17} strokeWidth={1.8} style={{ color, marginTop: "1px", flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 600, color: "var(--lt-ink-2)", fontSize: "13.5px" }}>{label}</span>
        {value !== undefined && (
          <p style={{ fontSize: "11.5px", color: "var(--lt-ink-4)", marginTop: "2px", wordBreak: "break-all", lineHeight: 1.5 }}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--lt-surface)", borderRadius: "16px",
      boxShadow: "var(--lt-card-shadow)", padding: "16px", marginBottom: "12px",
    }}>
      <p style={{
        fontSize: "11px", fontWeight: 700, color: "var(--lt-ink-4)",
        letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px",
      }}>
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PwaCheckPage() {
  const [result, setResult] = useState<DiagResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [diagCode, setDiagCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setLoading(true);
    setSent(false);
    try {
      const r = await runDiagnostics();
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!result) return;
    setSending(true);
    try {
      const res = await fetch("/api/pwa-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const data = await res.json() as { diagCode?: string };
      setDiagCode(data.diagCode ?? null);
      setSent(true);
    } catch {
      // Ignore — offline device
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    const text = [
      `=== PWA 诊断报告 ${diagCode ?? ""} ${result.timestamp} ===`,
      `UA: ${result.userAgent}`,
      `iOS: ${result.isIos} (${result.iosVersion}) | Android: ${result.isAndroid}`,
      `Standalone: ${result.isStandalone} | HTTPS: ${result.isHttps}`,
      `ServiceWorker: ${result.swSupported} (registered: ${result.swRegistered})`,
      `Notification: ${result.notifSupported} (perm: ${result.notifPerm})`,
      `PushManager: ${result.pushSupported}`,
      `manifest.json: ${result.manifestOk} (${result.manifestMime})`,
      `icon-192.png: ${result.icon192Ok}`,
      `apple-touch-icon: ${result.appleIconOk} (${result.appleIconMime}) → ${result.appleIconUrl}`,
    ].join("\n");
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const issues: string[] = [];
  if (result) {
    if (!result.isHttps) issues.push("非 HTTPS 环境，PWA 无法工作");
    if (!result.manifestOk) issues.push("manifest.json 加载失败 — 可能被重定向到登录页");
    if (!result.icon192Ok) issues.push("icon-192.png 加载失败");
    if (!result.appleIconOk)
      issues.push(
        result.appleIconMime.includes("html")
          ? `apple-touch-icon.png 被重定向到登录页（Cloudflare 缓存了 307）— 实际加载地址: ${result.appleIconUrl}`
          : "apple-touch-icon.png 加载失败"
      );
    if (!result.swRegistered && result.swSupported)
      issues.push("Service Worker 未注册 — 请从主屏幕打开 App 或刷新页面");
    if (result.isIos && !result.isStandalone)
      issues.push("iOS: 当前在 Safari 浏览器中运行，非独立模式 — 请先添加到主屏幕");
    if (result.isIos && !result.pushSupported)
      issues.push("iOS: Push 不可用（iOS 16.4+ 且必须在 PWA 模式下才支持）");
  }

  return (
    <div style={{
      minHeight: "100dvh", background: "var(--lt-bg)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "32px 16px 48px",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.02em", margin: 0 }}>
            PWA 诊断
          </h1>
          <p style={{ fontSize: "13px", color: "var(--lt-ink-4)", marginTop: "4px" }}>
            Life Timer · 设备兼容性检测
          </p>
        </div>

        {loading ? (
          <div style={{
            background: "var(--lt-surface)", borderRadius: "16px", boxShadow: "var(--lt-card-shadow)",
            padding: "32px", display: "flex", alignItems: "center", justifyContent: "center",
            gap: "10px", color: "var(--lt-ink-4)",
          }}>
            <RefreshCw size={18} className="lt-spin" />
            <span style={{ fontSize: "13px" }}>检测中…</span>
          </div>
        ) : result ? (
          <>
            {/* Issues Banner */}
            {issues.length > 0 && (
              <div style={{
                background: "var(--lt-danger-hover-bg)",
                border: "1px solid oklch(from var(--lt-danger) l c h / 0.25)",
                borderRadius: "14px", padding: "14px 16px", marginBottom: "14px",
              }}>
                <p style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--lt-danger)", marginBottom: "6px" }}>
                  发现 {issues.length} 个问题
                </p>
                {issues.map((issue, i) => (
                  <p key={i} style={{ fontSize: "12px", color: "var(--lt-danger-deep)", marginBottom: "3px", lineHeight: 1.6 }}>
                    · {issue}
                  </p>
                ))}
              </div>
            )}

            {issues.length === 0 && (
              <div style={{
                background: "oklch(from var(--lt-ok) l c h / 0.12)",
                border: "1px solid oklch(from var(--lt-ok) l c h / 0.30)",
                borderRadius: "14px", padding: "14px 16px", marginBottom: "14px",
              }}>
                <p style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--lt-ok-deep)" }}>
                  全部检测通过 ✓
                </p>
              </div>
            )}

            {/* Results */}
            <ResultSection title="设备">
              <Row label="HTTPS" ok={result.isHttps} />
              <Row
                label={result.isIos ? `iOS ${result.iosVersion}` : result.isAndroid ? "Android" : "Desktop"}
                ok={null}
                value={result.userAgent.slice(0, 80) + (result.userAgent.length > 80 ? "…" : "")}
              />
              <Row label="PWA 独立模式（Standalone）" ok={result.isStandalone} />
            </ResultSection>

            <ResultSection title="API 支持">
              <Row label="Service Worker 支持" ok={result.swSupported} />
              <Row label="Service Worker 已注册" ok={result.swRegistered} />
              <Row label="Notification API" ok={result.notifSupported} />
              <Row
                label={`通知权限: ${result.notifPerm}`}
                ok={result.notifPerm === "granted"}
                warn={result.notifPerm === "default"}
              />
              <Row label="PushManager" ok={result.pushSupported} />
            </ResultSection>

            <ResultSection title="资源加载">
              <Row label="manifest.json" ok={result.manifestOk} value={result.manifestMime} />
              <Row label="icon-192.png" ok={result.icon192Ok} />
              <Row
                label="apple-touch-icon.png"
                ok={result.appleIconOk}
                value={
                  !result.appleIconOk
                    ? `实际 MIME: ${result.appleIconMime || "无"} | 跳转至: ${result.appleIconUrl}`
                    : result.appleIconMime
                }
              />
            </ResultSection>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                onClick={send}
                disabled={sending || sent}
                className="lt-btn lt-btn-primary"
                style={{ flex: 1 }}
              >
                {sent ? (
                  <>
                    <Check size={15} strokeWidth={2.2} />
                    {diagCode ? `已发送 · ${diagCode}` : "已发送给管理员"}
                  </>
                ) : sending ? (
                  <>
                    <RefreshCw size={15} className="lt-spin" />
                    发送中…
                  </>
                ) : (
                  <>
                    <Send size={15} strokeWidth={1.8} />
                    发送报告给管理员
                  </>
                )}
              </button>

              <button onClick={copy} className="lt-btn lt-btn-ghost" style={{ padding: "0 16px" }}>
                {copied ? <Check size={15} strokeWidth={2.2} /> : <Copy size={15} strokeWidth={1.8} />}
              </button>

              <button onClick={run} className="lt-btn lt-btn-ghost" style={{ padding: "0 16px" }}>
                <RefreshCw size={15} strokeWidth={1.8} />
              </button>
            </div>

            <p style={{ fontSize: "11.5px", color: "var(--lt-ink-4)", textAlign: "center", marginTop: "16px" }}>
              检测时间: {new Date(result.timestamp).toLocaleString("zh-CN")}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
