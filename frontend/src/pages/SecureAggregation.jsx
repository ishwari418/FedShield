import { useEffect, useState } from "react";
import { CircleDashed, KeyRound, LockKeyhole, Radio, ShieldAlert, ShieldCheck } from "lucide-react";
import Panel from "../components/Panel.jsx";
import LoadState from "../components/LoadState.jsx";
import StatusPill from "../components/StatusPill.jsx";
import { api } from "../services/api.js";

const stages = ["Key setup", "Client setup", "Update masking", "Protected transmission", "Secure aggregation", "Aggregate recovery", "Global model update"];
export default function SecureAggregation() {
  const [privacy, setPrivacy] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { api("/api/privacy/status").then(setPrivacy).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  return <>
    <div className="page-intro compact"><div><div className="eyebrow"><span className="eyebrow-line" /> PROTOCOL CONTROL</div><h1>Secure <span>aggregation</span></h1><p>Flower SecAgg+ status and protocol stage visibility.</p></div><StatusPill tone="danger">Not active</StatusPill></div>
    <LoadState loading={loading} error={error}>{privacy && <>
      <div className="notice danger"><ShieldAlert size={18} /><div><strong>Flower SecAgg+ has not been integrated into the running training workflow</strong><span>This project does not claim cryptographic protection for individual model updates. The current coordinator sees each local update before FedAvg.</span></div></div>
      <div className="metric-grid three">
        <div className="metric-card"><div className="metric-top"><span>Protocol</span><div className="metric-icon amber"><CircleDashed size={17} /></div></div><div className="metric-value text-value">Not configured</div><div className="metric-note">No workflow executed</div></div>
        <div className="metric-card"><div className="metric-top"><span>Client threshold</span><div className="metric-icon violet"><KeyRound size={17} /></div></div><div className="metric-value text-value">—</div><div className="metric-note">No threshold configured</div></div>
        <div className="metric-card"><div className="metric-top"><span>Update visibility</span><div className="metric-icon red"><LockKeyhole size={17} /></div></div><div className="metric-value text-value danger-text">Visible</div><div className="metric-note">Plain FedAvg inputs reach aggregator</div></div>
      </div>
      <Panel title="Protocol stages" subtitle="A stage is marked complete only after the actual workflow reports success">
        <div className="stage-list">{stages.map((stage, index) => <div className="stage-row" key={stage}><span className="stage-number">{String(index + 1).padStart(2, "0")}</span><span className="stage-name">{stage}</span><span className="stage-state"><CircleDashed size={15} /> Not run</span></div>)}</div>
      </Panel>
      <div className="protocol-note"><Radio size={16} /><span>Flower documents <code>flwr.server.workflow.SecAggPlusWorkflow</code>. This demo currently pins Flower but does not invoke that workflow. See README for the exact limitation and next integration steps.</span></div>
    </>}</LoadState>
  </>;
}
