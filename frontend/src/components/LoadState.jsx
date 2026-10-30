export default function LoadState({ loading, error, children }) {
  if (loading) return <div className="load-state"><span className="spinner" /> Loading live workspace data…</div>;
  if (error) return <div className="error-state"><strong>Could not load data</strong><span>{error}</span><small>Check that the FastAPI backend is running at 127.0.0.1:8000.</small></div>;
  return children;
}
