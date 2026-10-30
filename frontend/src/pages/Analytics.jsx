import { useEffect, useState } from "react";
import { Activity, BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Panel from "../components/Panel.jsx";
import LoadState from "../components/LoadState.jsx";
import { api } from "../services/api.js";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { api("/api/analytics").then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const latest = data?.latest;
  return <>
    <div className="page-intro compact"><div><div className="eyebrow"><span className="eyebrow-line" /> HOLDOUT EVALUATION</div><h1>Model <span>analytics</span></h1><p>Global model metrics from an independent test dataset.</p></div></div>
    <LoadState loading={loading} error={error}>{data && <>
      <div className="metric-grid">
        {[["Accuracy", latest?.accuracy], ["Precision", latest?.precision], ["Recall", latest?.recall], ["F1 score", latest?.f1]].map(([label, value], index) => <div className="metric-card" key={label}><div className="metric-top"><span>{label}</span><div className={`metric-icon ${["blue", "violet", "green", "amber"][index]}`}><BarChart3 size={17} /></div></div><div className="metric-value">{value == null ? "—" : `${(value * 100).toFixed(1)}%`}</div><div className="metric-note">Measured on global holdout</div></div>)}
      </div>
      <div className="dashboard-grid">
        <Panel title="Accuracy by round" subtitle="Actual global-model predictions">
          {data.rounds.length ? <ResponsiveContainer width="100%" height={250}><LineChart data={data.rounds}><CartesianGrid stroke="#1b2b3d" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="round" stroke="#6b7b8d" tickLine={false} axisLine={false} /><YAxis domain={[0, 1]} stroke="#6b7b8d" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#0d1a29", border: "1px solid #25364a" }} /><Line dataKey="accuracy" stroke="#45c8ff" strokeWidth={2.5} /></LineChart></ResponsiveContainer> : <EmptyChart /> }
        </Panel>
        <Panel title="Loss by round" subtitle="Binary cross-entropy on test data">
          {data.rounds.length ? <ResponsiveContainer width="100%" height={250}><LineChart data={data.rounds}><CartesianGrid stroke="#1b2b3d" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="round" stroke="#6b7b8d" tickLine={false} axisLine={false} /><YAxis stroke="#6b7b8d" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#0d1a29", border: "1px solid #25364a" }} /><Line dataKey="loss" stroke="#8b83ff" strokeWidth={2.5} /></LineChart></ResponsiveContainer> : <EmptyChart /> }
        </Panel>
      </div>
      <div className="dashboard-grid">
        <Panel title="Client data distribution" subtitle="Sample counts only; no records returned">
          <ResponsiveContainer width="100%" height={220}><BarChart data={Object.entries(data.client_sample_counts).map(([name, count]) => ({ name: name.replace("hospital-", "Hospital ").toUpperCase(), count }))}><CartesianGrid stroke="#1b2b3d" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="name" stroke="#6b7b8d" tickLine={false} axisLine={false} /><YAxis stroke="#6b7b8d" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#0d1a29", border: "1px solid #25364a" }} /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{[0, 1, 2].map((index) => <Cell key={index} fill={["#45c8ff", "#8b83ff", "#39d9a5"][index]} />)}</Bar></BarChart></ResponsiveContainer>
        </Panel>
        <Panel title="Confusion matrix" subtitle="Latest global test evaluation">
          {latest ? <div className="confusion-wrap"><div className="confusion-labels"><span>Actual 0</span><span>Actual 1</span></div><div className="confusion-grid">{latest.confusion_matrix.flat().map((value, index) => <div key={index} className={`confusion-cell c${index}`}>{value}<small>{["True negative", "False positive", "False negative", "True positive"][index]}</small></div>)}</div></div> : <EmptyChart />}
        </Panel>
      </div>
      <div className="protocol-note"><Activity size={15} />{data.evaluation_dataset}</div>
    </>}</LoadState>
  </>;
}
function EmptyChart() { return <div className="empty-chart"><BarChart3 size={20} /><strong>No evaluation yet</strong><span>Train a model to populate this chart.</span></div>; }
