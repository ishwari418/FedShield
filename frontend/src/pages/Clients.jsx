import { useEffect, useState } from "react";
import { Database, HardDrive, RadioTower, ShieldCheck } from "lucide-react";
import Panel from "../components/Panel.jsx";
import LoadState from "../components/LoadState.jsx";
import StatusPill from "../components/StatusPill.jsx";
import { api } from "../services/api.js";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const refresh = () => api("/api/clients")
      .then((result) => { if (active) { setClients(result); setError(""); setLoading(false); } })
      .catch((e) => { if (active) { setError(e.message); setLoading(false); } });
    refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return <>
    <div className="page-intro compact"><div><div className="eyebrow"><span className="eyebrow-line" /> LOCAL PARTITIONS</div><h1>Client <span>organizations</span></h1><p>Three simulated hospital clients with separate local training partitions.</p></div></div>
    <LoadState loading={loading} error={error}><Panel title="Registered organizations" subtitle="Only aggregate partition metadata is returned by the API">
      <div className="table-wrap"><table><thead><tr><th>ORGANIZATION</th><th>LOCAL SAMPLES</th><th>TRAINING DATA</th><th>CONNECTION</th><th>DATA EXPOSURE</th></tr></thead><tbody>
        {clients.map((client, index) => <tr key={client.id}><td><div className="table-client"><span className={`client-avatar client-${index}`}>{String.fromCharCode(65 + index)}</span><div><strong>{client.name}</strong><small>{client.id}</small></div></div></td><td>{client.samples.toLocaleString()} <span className="muted">records</span></td><td><span className="path-label"><HardDrive size={13} />{client.dataset_path}</span></td><td><StatusPill tone={client.status === "training" ? "warning" : "success"}>{client.status}</StatusPill></td><td><span className="privacy-cell"><ShieldCheck size={14} /> Rows not exposed</span></td></tr>)}
      </tbody></table></div>
      <div className="callout-note"><Database size={15} /><span>Client CSV files are generated locally under <code>data/clients/&lt;client-id&gt;/</code>. This demonstration does not model real network isolation.</span></div>
    </Panel></LoadState>
  </>;
}
