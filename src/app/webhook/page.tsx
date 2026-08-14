"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Copy, Check, Eye, EyeOff, RotateCw, Webhook as WebhookIcon,
  Inbox, RefreshCw, BellRing, BellOff,
} from "lucide-react";
import { usePushSubscription } from "@/lib/use-push-subscription";

interface LogEntry {
  id: number;
  title: string;
  body: string;
  status: "sent" | "undelivered";
  delivered: number;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskUrl(url: string): string {
  const marker = "/push/";
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const prefix = url.slice(0, i + marker.length);
  const token = url.slice(i + marker.length);
  if (token.length <= 8) return prefix + "•".repeat(token.length);
  return `${prefix}${token.slice(0, 4)}${"•".repeat(Math.max(token.length - 8, 6))}${token.slice(-4)}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = sameYear
    ? d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
    : d.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
  return `${date} ${time}`;
}

// ── WebhookUrlCard ────────────────────────────────────────────────────────────

function WebhookUrlCard({
  url, loading, onRotate,
}: {
  url: string | null;
  loading: boolean;
  onRotate: () => Promise<void>;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [rotating, setRotating] = useState(false);

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const doRotate = async () => {
    setRotating(true);
    try {
      await onRotate();
      setConfirmingRotate(false);
      setRevealed(true);
    } finally {
      setRotating(false);
    }
  };

  return (
    <div style={{
      background: "var(--lt-surface)", borderRadius: "18px", padding: "20px",
      boxShadow: "var(--lt-card-shadow)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <WebhookIcon size={16} strokeWidth={1.8} style={{ color: "var(--lt-ink-3)" }} />
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--lt-ink-1)", margin: 0 }}>
          Webhook 地址
        </h2>
      </div>
      <p style={{ fontSize: "12.5px", color: "var(--lt-ink-4)", margin: "2px 0 14px", lineHeight: 1.5 }}>
        向这个地址发送 POST 请求即可推送通知到你的设备。地址本身就是唯一凭证，不需要额外登录或签名。
      </p>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--lt-ink-4)", fontSize: "13px", padding: "8px 0" }}>
          <RefreshCw size={14} className="lt-spin" /> 加载中…
        </div>
      ) : url ? (
        <>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              readOnly
              value={revealed ? url : maskUrl(url)}
              onFocus={(e) => e.currentTarget.select()}
              className="lt-auth-input lt-auth-input--mono"
              style={{ flex: 1, fontSize: "12.5px" }}
            />
            <button
              onClick={() => setRevealed((v) => !v)}
              title={revealed ? "隐藏地址" : "显示完整地址"}
              style={{
                width: "40px", flexShrink: 0, border: "1px solid var(--lt-border)",
                borderRadius: "10px", background: "transparent", cursor: "pointer",
                color: "var(--lt-ink-3)", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {revealed ? <EyeOff size={15} strokeWidth={1.8} /> : <Eye size={15} strokeWidth={1.8} />}
            </button>
            <button
              onClick={copy}
              title="复制地址"
              style={{
                width: "40px", flexShrink: 0, border: "none", borderRadius: "10px",
                background: copied ? "var(--lt-ok)" : "var(--lt-ink-1)",
                color: copied ? "#fff" : "var(--lt-on-ink)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 150ms ease-out",
              }}
            >
              {copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={1.8} />}
            </button>
          </div>

          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {!confirmingRotate ? (
              <button
                onClick={() => setConfirmingRotate(true)}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--lt-border)",
                  background: "transparent", color: "var(--lt-ink-3)",
                  fontSize: "12.5px", fontWeight: 600, cursor: "pointer",
                }}
              >
                <RotateCw size={12} strokeWidth={2} /> 重置地址
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--lt-danger)", fontWeight: 600 }}>
                  重置后旧地址立即失效，确认？
                </span>
                <button
                  onClick={doRotate}
                  disabled={rotating}
                  style={{
                    padding: "5px 10px", borderRadius: "7px", border: "none",
                    background: "var(--lt-danger)", color: "#fff",
                    fontSize: "12px", fontWeight: 700, cursor: "pointer", opacity: rotating ? 0.6 : 1,
                  }}
                >
                  {rotating ? "重置中…" : "确认重置"}
                </button>
                <button
                  onClick={() => setConfirmingRotate(false)}
                  disabled={rotating}
                  style={{
                    padding: "5px 10px", borderRadius: "7px", border: "none",
                    background: "var(--lt-surface-2)", color: "var(--lt-ink-2)",
                    fontSize: "12px", fontWeight: 600, cursor: "pointer",
                  }}
                >
                  取消
                </button>
              </div>
            )}
          </div>

          <details style={{ marginTop: "14px" }}>
            <summary style={{ fontSize: "12.5px", color: "var(--lt-ink-4)", cursor: "pointer", userSelect: "none" }}>
              调用示例
            </summary>
            <pre style={{
              marginTop: "8px", padding: "10px 12px", borderRadius: "10px",
              background: "var(--lt-surface-2)", overflowX: "auto",
              fontSize: "11.5px", lineHeight: 1.6, color: "var(--lt-ink-2)",
              fontFamily: "ui-monospace, monospace",
            }}>
{`curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{"title":"提醒","body":"水表读数已超预警线"}'`}
            </pre>
          </details>
        </>
      ) : (
        <p style={{ fontSize: "13px", color: "var(--lt-danger)" }}>地址加载失败，请刷新重试。</p>
      )}
    </div>
  );
}

// ── PushSubscriptionCard ──────────────────────────────────────────────────────
// Subscribing lives on the home header (bell icon); unsubscribing lives here so
// the header only ever needs one notification-related icon.

function PushSubscriptionCard() {
  const { subscribed, loading, supported, iosNeedsPWA, toggle } = usePushSubscription(true);

  if (!supported && !iosNeedsPWA) return null;

  return (
    <div style={{
      background: "var(--lt-surface)", borderRadius: "18px", padding: "16px 20px",
      boxShadow: "var(--lt-card-shadow)", marginBottom: "16px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "9999px", flexShrink: 0,
          background: subscribed ? "var(--lt-ink-1)" : "var(--lt-surface-2)",
          color: subscribed ? "var(--lt-on-ink)" : "var(--lt-ink-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {subscribed ? <BellRing size={16} strokeWidth={1.8} /> : <BellOff size={16} strokeWidth={1.8} />}
        </div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--lt-ink-1)" }}>
            推送通知{iosNeedsPWA ? "" : subscribed ? "已开启" : "未开启"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--lt-ink-4)", marginTop: "2px" }}>
            {iosNeedsPWA
              ? "iOS 需先添加到主屏幕（分享 → 添加到主屏幕）才能启用"
              : subscribed
                ? "本设备将实时收到 webhook 推送提醒"
                : "开启后本设备才能收到 webhook 推送提醒"}
          </div>
        </div>
      </div>
      {!iosNeedsPWA && (
        <button
          onClick={toggle}
          disabled={loading}
          style={{
            flexShrink: 0, padding: "7px 14px", borderRadius: "9px",
            border: subscribed ? "1px solid var(--lt-border)" : "none",
            background: subscribed ? "transparent" : "var(--lt-ink-1)",
            color: subscribed ? "var(--lt-ink-3)" : "var(--lt-on-ink)",
            fontSize: "12.5px", fontWeight: 700, cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "处理中…" : subscribed ? "关闭推送" : "开启推送"}
        </button>
      )}
    </div>
  );
}

// ── LogCard ───────────────────────────────────────────────────────────────────

function LogCard({ entry, highlighted }: { entry: LogEntry; highlighted: boolean }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const copy = async () => {
    await navigator.clipboard.writeText(entry.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={ref}
      style={{
        background: "var(--lt-surface)", borderRadius: "16px", padding: "14px 16px",
        boxShadow: highlighted ? "0 0 0 2px var(--lt-ink-1)" : "var(--lt-card-shadow)",
        transition: "box-shadow 600ms ease-out",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--lt-ink-1)" }}>{entry.title}</span>
            {entry.status === "sent" ? (
              <span title={`已送达 ${entry.delivered} 台设备`} style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10.5px", color: "var(--lt-ok)" }}>
                <BellRing size={11} strokeWidth={2} /> 已推送
              </span>
            ) : (
              <span title="未有设备收到推送（可能未开启通知）" style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10.5px", color: "var(--lt-ink-4)" }}>
                <BellOff size={11} strokeWidth={2} /> 未送达
              </span>
            )}
          </div>
          <p style={{ fontSize: "13px", color: "var(--lt-ink-2)", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {entry.body}
          </p>
          <div style={{ fontSize: "11px", color: "var(--lt-ink-4)", marginTop: "6px" }}>
            {formatTime(entry.createdAt)}
          </div>
        </div>
        <button
          onClick={copy}
          title="复制内容"
          style={{
            flexShrink: 0, width: "32px", height: "32px", borderRadius: "9px",
            border: "none", background: copied ? "var(--lt-ok)" : "var(--lt-surface-2)",
            color: copied ? "#fff" : "var(--lt-ink-3)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 150ms ease-out, color 150ms ease-out",
          }}
        >
          {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={1.8} />}
        </button>
      </div>
    </div>
  );
}

// ── WebhookPageInner ──────────────────────────────────────────────────────────

function WebhookPageInner() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [url, setUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // The backend only ever returns the bare token — the origin is always taken
  // from the browser's own address bar so the displayed URL matches exactly
  // what the user is visiting, even behind a reverse proxy / CDN that might
  // otherwise make the server see the wrong host or scheme.
  const buildUrl = (token: string) => `${window.location.origin}/api/webhook/push/${token}`;

  const loadUrl = useCallback(async () => {
    setUrlLoading(true);
    try {
      const res = await fetch("/api/webhook/token");
      if (res.ok) {
        const data = await res.json();
        setUrl(buildUrl(data.token));
      }
    } finally {
      setUrlLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/webhook/log");
      if (res.ok) setLogs(await res.json());
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { loadUrl(); loadLogs(); }, [loadUrl, loadLogs]);

  const handleRotate = useCallback(async () => {
    const res = await fetch("/api/webhook/token/rotate", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setUrl(buildUrl(data.token));
    }
  }, []);

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "0 20px 48px" }}>
      {/* Header */}
      <div style={{ padding: "32px 0 24px", display: "flex", alignItems: "center", gap: "12px" }}>
        <Link href="/" style={{
          width: "40px", height: "40px", borderRadius: "9999px",
          background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--lt-ink-2)", textDecoration: "none", flexShrink: 0,
          transition: "transform 120ms ease-out",
        }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1.06)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </Link>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--lt-ink-1)", letterSpacing: "-0.03em", margin: 0 }}>
            Webhook 通知
          </h1>
          <p style={{ fontSize: "13px", color: "var(--lt-ink-4)", marginTop: "2px" }}>
            管理你的推送地址，查看历史通知
          </p>
        </div>
      </div>

      {/* Push subscription (unsubscribe lives here; subscribing is on the home header) */}
      <PushSubscriptionCard />

      {/* URL management */}
      <WebhookUrlCard url={url} loading={urlLoading} onRotate={handleRotate} />

      {/* Notification history */}
      <div style={{ marginTop: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Inbox size={15} strokeWidth={1.8} style={{ color: "var(--lt-ink-3)" }} />
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--lt-ink-1)", margin: 0 }}>
            通知记录
          </h2>
          {logs.length > 0 && (
            <span style={{ fontSize: "12px", color: "var(--lt-ink-4)" }}>{logs.length} 条</span>
          )}
        </div>

        {logsLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "32px 0", color: "var(--lt-ink-4)" }}>
            <RefreshCw size={18} className="lt-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "var(--lt-surface)", borderRadius: "16px" }}>
            <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>
              暂无通知记录，向上方地址发一个请求试试
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {logs.map((entry) => (
              <LogCard key={entry.id} entry={entry} highlighted={String(entry.id) === highlightId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WebhookPage() {
  return (
    <Suspense fallback={null}>
      <WebhookPageInner />
    </Suspense>
  );
}
