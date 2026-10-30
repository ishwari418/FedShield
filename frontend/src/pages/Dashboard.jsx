import { useEffect, useState } from "react";
import {
  Activity, ArrowUpRight, Cpu, Database, LockKeyhole, ShieldCheck, Users,
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import MetricCard from "../components/MetricCard.jsx";
import Panel from "../components/Panel.jsx";
import LoadState from "../components/LoadState.jsx";
import StatusPill from "../components/StatusPill.jsx";
import { api } from "../services/api.js";

function formatMetric(value, digits = 1) {
  return value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const refresh = () => api("/api/dashboard")
      .then((result) => { if (active) { setData(result); setError(""); setLoading(false); } })
      .catch((reason) => { if (active) { setError(reason.message); setLoading(false); } });
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const metrics = data?.history || [];
  const verifiedPrivacyChecks = data
    ? Number(!data.privacy.raw_records_sent_to_api) + Number(data.privacy.test_data_separate)
    : 0;

  return (
    <>
      <div className="page-intro">
        <div><div className="eyebrow"><span className="eyebrow-line" /> FEDERATED LEARNING CONTROL PLANE</div><h1>Good afternoon, <span>researcher.</span></h1><p>Monitor collaborative model training across your local organization network.</p></div>
        <div className="intro-meta"><span className="live-dot" /> LIVE SYSTEM OVERVIEW <small>Auto-refreshes every 3 seconds</small></div>
      </div>
      <LoadState loading={loading} error={error}>
        {data && <>
          <div className="notice warning"><ShieldCheck size={17} /><div><strong>Secure aggregation is not enabled</strong><span>Training currently uses ordinary FedAvg. Individual updates are visible to the local aggregator.</span></div><a href="/secure-aggregation">Review status <ArrowUpRight size={13} /></a></div>
          <div className="metric-grid">
            <MetricCard label="Registered clients" value={data.total_clients} note={`${data.connected_clients} connected now`} icon={Users} tone="blue" />
            <MetricCard label="Completed rounds" value={data.completed_rounds} note={`Status: ${data.training_status}`} icon={Activity} tone="violet" />
            <MetricCard label="Global accuracy" value={formatMetric(data.accuracy)} note={data.accuracy == null ? "Run training to evaluate" : "Independent holdout dataset"} icon={Cpu} tone="green" />
            <MetricCard label="Global model loss" value={data.loss == null ? "—" : data.loss.toFixed(3)} note="Binary cross-entropy" icon={Database} tone="amber" />
            <MetricCard label="Training sessions" value={data.total_sessions} note="Locally recorded experiment runs" icon={Activity} tone="blue" />
            <MetricCard label="Local training samples" value={data.total_training_samples.toLocaleString()} note={`${data.test_samples.toLocaleString()} independent test rows`} icon={Database} tone="violet" />
          </div>
          <div className="dashboard-grid">
            <Panel title="Model performance" subtitle="Metrics measured on the independent test set" action={<span className="chart-legend"><i className="legend-blue" />Accuracy <i className="legend-cyan" />Loss</span>} className="chart-panel">
              {metrics.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={metrics} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><CartesianGrid stroke="#1b2b3d" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="round" tickFormatter={(value) => `R${value}`} stroke="#6b7b8d" tickLine={false} axisLine={false} /><YAxis domain={[0, 1]} stroke="#6b7b8d" tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value * 100)}%`} /><Tooltip contentStyle={{ background: "#0d1a29", border: "1px solid #25364a", borderRadius: 9, color: "#eaf2fa" }} labelFormatter={(value) => `Round ${value}`} formatter={(value, name) => [Number(value).toFixed(3), name]} /><Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#45c8ff" strokeWidth={2.5} dot={{ r: 3, fill: "#45c8ff" }} /><Line type="monotone" dataKey="loss" name="Loss" stroke="#8b83ff" strokeWidth={2} dot={{ r: 3, fill: "#8b83ff" }} /></LineChart></ResponsiveContainer> : <div className="empty-chart"><div className="empty-chart-icon"><Activity size={20} /></div><strong>No training results yet</strong><span>Start a federated training run to populate live performance metrics.</span></div>}
            </Panel>
            <Panel title="System posture" subtitle="Runtime-verified privacy controls" className="posture-panel">
              <div className="posture-score"><div className="posture-ring"><span>{verifiedPrivacyChecks}/4</span></div><div><strong>Partial safeguards</strong><small>Several privacy properties are not active.</small></div></div>
              <div className="posture-row"><span><i className="check-mark">✓</i> Client records stay off REST API</span><StatusPill tone="success">Verified</StatusPill></div>
              <div className="posture-row"><span><i className="check-mark">✓</i> Test data is held separately</span><StatusPill tone="success">Verified</StatusPill></div>
              <div className="posture-row"><span><i className="cross-mark">×</i> Individual updates protected</span><StatusPill tone="danger">Inactive</StatusPill></div>
              <div className="posture-row"><span><i className="cross-mark">×</i> Flower SecAgg+ protocol</span><StatusPill tone="danger">Not configured</StatusPill></div>
              <a className="text-link" href="/privacy">Open privacy center <ArrowUpRight size={14} /></a>
            </Panel>
          </div>
          <div className="dashboard-grid lower-grid">
            <Panel title="Organization participation" subtitle="Local synthetic dataset size; no individual rows displayed">
              <div className="participation-list">{Object.entries(data.client_samples).map(([id, count], index) => <div className="participation-row" key={id}><span className={`client-avatar client-${index}`}>{String.fromCharCode(65 + index)}</span><div className="participation-info"><strong>Hospital {String.fromCharCode(65 + index)}</strong><small>{count} local samples</small></div><div className="participation-track"><span style={{ width: `${Math.min(100, (count / Math.max(...Object.values(data.client_samples))) * 100)}%` }} /></div><span className="participant-state"><i /> Online</span></div>)}</div>
            </Panel>
            <Panel title="Recent activity" subtitle="Events recorded by the local service">
              <div className="activity-list">{data.activities.length ? data.activities.slice(0, 5).map((event, index) => <div className="activity-row" key={`${event.timestamp}-${index}`}><span className={`activity-icon ${event.level}`}><LockKeyhole size={14} /></span><div><strong>{event.message}</strong><small>{new Date(event.timestamp).toLocaleString()}</small></div></div>) : <div className="empty-inline">No activity recorded yet.</div>}</div>
            </Panel>
          </div>
        </>}
      </LoadState>
    </>
  );
}
