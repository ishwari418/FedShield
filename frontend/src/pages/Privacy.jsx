import { useEffect, useState } from "react";
import { CheckCircle2, Info, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import Panel from "../components/Panel.jsx";
import LoadState from "../components/LoadState.jsx";
import { api } from "../services/api.js";

export default function Privacy() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { api("/api/privacy/status").then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  return <>
    <div className="page-intro compact"><div><div className="eyebrow"><span className="eyebrow-line" /> VERIFIED CONTROLS</div><h1>Privacy <span>center</span></h1><p>Distinguish what the demo verifies from what remains unimplemented.</p></div></div>
    <LoadState loading={loading} error={error}>{data && <>
      <div className="notice warning"><Info size={17} /><div><strong>Privacy is not a single guarantee</strong><span>Local data handling, secure aggregation and differential privacy address different risks. This demo does not provide complete privacy protection.</span></div></div>
      <Panel title="Privacy checklist" subtitle="Status reflects actual running behavior">
        <div className="checklist">{data.checks.map((check) => <div className="checklist-row" key={check.label}><span className={check.verified ? "verify-icon" : "unverified-icon"}>{check.verified ? <CheckCircle2 size={18} /> : <XCircle size={18} />}</span><span>{check.label}</span><strong className={check.verified ? "verified-text" : "unverified-text"}>{check.verified ? "Verified" : "Not verified"}</strong></div>)}</div>
      </Panel>
      <Panel title="Security boundaries" subtitle="Known limitations">
        <div className="limitation-list">{data.limitations.map((item) => <div key={item}><ShieldAlert size={15} /><span>{item}</span></div>)}</div>
      </Panel>
      <div className="concept-grid">{Object.entries(data.definitions).map(([key, description], index) => <div className="concept-card" key={key}><div className={`concept-icon c${index}`}>{index === 0 ? <ShieldCheck size={17} /> : index === 1 ? <ShieldAlert size={17} /> : <Info size={17} />}</div><strong>{key.replaceAll("_", " ")}</strong><p>{description}</p></div>)}</div>
    </>}</LoadState>
  </>;
}
