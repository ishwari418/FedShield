import { useEffect, useState } from "react";
import { Activity, CircleStop, Play, RotateCcw } from "lucide-react";
import Panel from "../components/Panel.jsx";
import LoadState from "../components/LoadState.jsx";
import StatusPill from "../components/StatusPill.jsx";
import { api } from "../services/api.js";

export default function Training() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [parameters, setParameters] = useState({ rounds: 5, local_epochs: 1, learning_rate: 0.05, batch_size: 256 });
  const refresh = () => Promise.all([api("/api/training/status"), api("/api/training/history")])
    .then(([nextStatus, nextHistory]) => { setStatus(nextStatus); setHistory(nextHistory); setError(""); })
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 1000); return () => window.clearInterval(timer); }, []);
  const update = (key, value) => setParameters((previous) => ({ ...previous, [key]: Number(value) }));
  async function begin() {
    try { await api("/api/training/start", { method: "POST", body: JSON.stringify(parameters) }); setNotice("Training started."); setError(""); refresh(); }
    catch (e) { setError(e.message); }
  }
  async function stop() {
    try { await api("/api/training/stop", { method: "POST" }); setNotice("Stop requested; active local client will finish."); setError(""); refresh(); }
    catch (e) { setError(e.message); }
  }
  const running = status?.state === "running";
  return <>
    <div className="page-intro compact"><div><div className="eyebrow"><span className="eyebrow-line" /> EXPERIMENT CONTROL</div><h1>Model <span>training</span></h1><p>Run a real CPU PyTorch experiment across the local synthetic client partitions.</p></div></div>
    <div className="notice warning"><Activity size={17} /><div><strong>Unprotected FedAvg</strong><span>Local training and weighted aggregation run for real. Secure aggregation is not part of this trainer.</span></div></div>
    {notice && <div className="notice success"><span className="status-dot green" /><div><strong>{notice}</strong></div></div>}
    {error && <div className="notice danger"><strong>{error}</strong></div>}
    <LoadState loading={loading} error={""}><div className="training-layout">
      <Panel title="Configure experiment" subtitle="Parameters are validated by the backend">
        <div className="form-grid">
          <label>Federated rounds<input type="number" min="1" max="50" value={parameters.rounds} onChange={(e) => update("rounds", e.target.value)} /></label>
          <label>Local epochs<input type="number" min="1" max="10" value={parameters.local_epochs} onChange={(e) => update("local_epochs", e.target.value)} /></label>
          <label>Learning rate<input type="number" min="0.001" max="1" step="0.005" value={parameters.learning_rate} onChange={(e) => update("learning_rate", e.target.value)} /></label>
          <label>Batch size<input type="number" min="1" max="512" value={parameters.batch_size} onChange={(e) => update("batch_size", e.target.value)} /></label>
        </div>
        <div className="training-actions"><button className="primary-button" disabled={running} onClick={begin}><Play size={15} fill="currentColor" /> Start training</button><button className="secondary-button" disabled={!running} onClick={stop}><CircleStop size={15} /> Stop run</button><button className="icon-action" onClick={refresh} title="Refresh"><RotateCcw size={15} /></button></div>
      </Panel>
      <Panel title="Live session" subtitle="Progress updates only after completed computation">
        {status && <><div className="session-state"><StatusPill tone={running ? "warning" : status.state === "completed" ? "success" : "neutral"}>{status.state}</StatusPill><span>{status.message}</span></div><div className="progress-wrap"><div className="progress-label"><span>Completed rounds</span><strong>{status.current_round} / {status.total_rounds}</strong></div><div className="progress-track"><span style={{ width: `${status.progress}%` }} /></div></div><div className="client-progress">{Object.entries(status.client_status).map(([id, state]) => <div key={id}><span className={`client-mini ${state === "training" ? "active" : ""}`} />{id.replace("hospital-", "Hospital ").toUpperCase()}<StatusPill tone={state === "training" ? "warning" : "success"}>{state}</StatusPill></div>)}</div>{status.error && <div className="error-inline">{status.error}</div>}</>}
      </Panel>
    </div></LoadState>
    <Panel title="Experiment history" subtitle="Metrics from real independent holdout evaluations">
      {history.length ? <div className="table-wrap"><table><thead><tr><th>ROUND</th><th>ACCURACY</th><th>PRECISION</th><th>RECALL</th><th>F1</th><th>LOSS</th><th>AGGREGATION</th></tr></thead><tbody>{history.slice(-15).reverse().map((item) => <tr key={`${item.timestamp}-${item.round}`}><td>Round {item.round}</td><td>{(item.accuracy * 100).toFixed(1)}%</td><td>{(item.precision * 100).toFixed(1)}%</td><td>{(item.recall * 100).toFixed(1)}%</td><td>{(item.f1 * 100).toFixed(1)}%</td><td>{item.loss.toFixed(3)}</td><td><span className="muted">FedAvg · unprotected</span></td></tr>)}</tbody></table></div> : <div className="empty-inline">No rounds have been saved.</div>}
    </Panel>
  </>;
}
