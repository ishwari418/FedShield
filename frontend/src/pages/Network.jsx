import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, CircleDashed, Database, LockKeyhole, RadioTower, Server, ShieldAlert } from "lucide-react";
import Panel from "../components/Panel.jsx";
import StatusPill from "../components/StatusPill.jsx";
import LoadState from "../components/LoadState.jsx";
import { api } from "../services/api.js";

export default function Network() {
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
    <div className="page-intro compact"><div><div className="eyebrow"><span className="eyebrow-line" /> TOPOLOGY & PARTICIPATION</div><h1>Federated <span>network</span></h1><p>Inspect the local training topology and the actual data flow.</p></div></div>
    <div className="notice warning"><ShieldAlert size={17} /><div><strong>Single-machine simulation</strong><span>Organizations run as logical client partitions inside the backend process, not isolated hospital systems.</span></div></div>
    <LoadState loading={loading} error={error}><Panel title="Training topology" subtitle="Global model distribution and client-side local training">
      <div className="topology">
        <div className="topology-server"><div className="node-icon server"><Server size={23} /></div><strong>FedShield coordinator</strong><small>FastAPI local process</small><StatusPill tone="success">Online</StatusPill></div>
        <div className="topology-connectors"><div className="connector"><ArrowDown size={17} /><span>Model parameters</span></div><div className="connector"><ArrowUp size={17} /><span>Individual updates (unprotected)</span></div></div>
        <div className="topology-clients">{clients.map((client, index) => <div className="topology-client" key={client.id}><div className={`node-icon client-${index}`}><RadioTower size={21} /></div><strong>{client.name}</strong><small>Local CSV · PyTorch client</small><StatusPill tone={client.status === "training" ? "warning" : "success"}>{client.status}</StatusPill><div className="node-foot"><Database size={13} /> {client.samples} local records in partition folder</div></div>)}</div>
        <div className="topology-legend"><span><i className="legend-blue" /> Model broadcast</span><span><i className="legend-violet" /> Client return path</span><span><LockKeyhole size={13} /> Encryption is not active</span></div>
      </div>
    </Panel></LoadState>
    <div className="section-grid">
      <Panel title="Workflow" subtitle="Current request lifecycle">
        <div className="flow-list">{["Initialize shared model", "Distribute parameters", "Train locally on each client", "Aggregate with weighted FedAvg", "Evaluate on independent test set"].map((step, index) => <div key={step} className="flow-step"><span className="flow-index">{String(index + 1).padStart(2, "0")}</span><span>{step}</span><CheckCircle2 size={16} className="flow-check" /></div>)}</div>
      </Panel>
      <Panel title="Secure protocol" subtitle="Flower SecAgg+ integration">
        <div className="protocol-empty"><CircleDashed size={27} /><strong>Not configured</strong><span>No Flower SecAgg+ workflow is invoked by this local trainer. Updates are visible to the coordinator.</span></div>
      </Panel>
    </div>
  </>;
}
