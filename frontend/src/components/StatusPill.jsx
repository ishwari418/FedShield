export default function StatusPill({ children, tone = "neutral" }) {
  return <span className={`status-pill ${tone}`}><span className="pill-dot" />{children}</span>;
}
