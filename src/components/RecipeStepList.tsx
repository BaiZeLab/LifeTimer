/** Reading view for steps: 16px body so it stays legible with the phone propped on the counter. */
export function RecipeStepList({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {steps.map((content, idx) => (
        <div key={idx} style={{
          display: "grid", gridTemplateColumns: "26px 1fr", gap: "12px",
          alignItems: "start", padding: "12px 0",
          borderBottom: idx === steps.length - 1 ? "none" : "1px solid var(--lt-border-muted)",
        }}>
          <span style={{
            width: "26px", height: "26px", borderRadius: "9999px",
            background: "var(--lt-surface-2)", color: "var(--lt-ink-3)",
            fontSize: "12px", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginTop: "1px",
          }}>
            {idx + 1}
          </span>
          <div style={{
            fontSize: "16px", lineHeight: 1.7, color: "var(--lt-ink-1)",
            whiteSpace: "pre-wrap", minWidth: 0, overflowWrap: "anywhere",
          }}>
            {content}
          </div>
        </div>
      ))}
    </div>
  );
}
