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
      ? "text-gray-400"
      : ok
      ? "text-green-500"
      : warn
      ? "text-amber-500"
      : "text-red-500";

  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <Icon size={18} className={`${color} mt-0.5 shrink-0`} />
      <div className="min-w-0 flex-1">
        <span className="font-medium text-gray-800 text-sm">{label}</span>
        {value !== undefined && (
          <p className="text-xs text-gray-500 mt-0.5 break-all">{value}</p>
        )}
      </div>
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">PWA 诊断</h1>
          <p className="text-sm text-gray-500 mt-1">Life Timer · 设备兼容性检测</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 flex items-center justify-center gap-3 text-gray-500">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm">检测中…</span>
          </div>
        ) : result ? (
          <>
            {/* Issues Banner */}
            {issues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-red-700 mb-2">发现 {issues.length} 个问题</p>
                {issues.map((issue, i) => (
                  <p key={i} className="text-xs text-red-600 mb-1 leading-relaxed">• {issue}</p>
                ))}
              </div>
            )}

            {issues.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-green-700">全部检测通过 ✓</p>
              </div>
            )}

            {/* Results */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">设备</p>
              <Row label="HTTPS" ok={result.isHttps} />
              <Row
                label={result.isIos ? `iOS ${result.iosVersion}` : result.isAndroid ? "Android" : "Desktop"}
                ok={null}
                value={result.userAgent.slice(0, 80) + (result.userAgent.length > 80 ? "…" : "")}
              />
              <Row label="PWA 独立模式（Standalone）" ok={result.isStandalone} />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">API 支持</p>
              <Row label="Service Worker 支持" ok={result.swSupported} />
              <Row label="Service Worker 已注册" ok={result.swRegistered} />
              <Row label="Notification API" ok={result.notifSupported} />
              <Row
                label={`通知权限: ${result.notifPerm}`}
                ok={result.notifPerm === "granted"}
                warn={result.notifPerm === "default"}
              />
              <Row label="PushManager" ok={result.pushSupported} />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">资源加载</p>
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
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={send}
                disabled={sending || sent}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-60"
              >
                {sent ? (
                  <>
                    <Check size={16} />
                    {diagCode ? `已发送 · ${diagCode}` : "已发送给管理员"}
                  </>
                ) : sending ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    发送中…
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    发送报告给管理员
                  </>
                )}
              </button>

              <button
                onClick={copy}
                className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-3 text-sm"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>

              <button
                onClick={run}
                className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-3 text-sm"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
              检测时间: {new Date(result.timestamp).toLocaleString("zh-CN")}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
