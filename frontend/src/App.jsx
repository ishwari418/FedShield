import { lazy, Suspense, useEffect, useState } from "react";
import { Activity, Bell, ChevronDown, CircleHelp } from "lucide-react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import { api } from "./services/api.js";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Network = lazy(() => import("./pages/Network.jsx"));
const Clients = lazy(() => import("./pages/Clients.jsx"));
const Training = lazy(() => import("./pages/Training.jsx"));
const SecureAggregation = lazy(() => import("./pages/SecureAggregation.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));

const pageTitles = {
  "/": "Overview",
  "/network": "Federated network",
  "/clients": "Organizations",
  "/training": "Model training",
  "/secure-aggregation": "Secure aggregation",
  "/analytics": "Model analytics",
  "/privacy": "Privacy center",
  "/reports": "Reports",
};

export default function App() {
  const location = useLocation();
  const [apiState, setApiState] = useState("checking");
  useEffect(() => {
    let active = true;
    const check = () => api("/api/health")
      .then(() => active && setApiState("online"))
      .catch(() => active && setApiState("offline"));
    check();
    const timer = window.setInterval(check, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>FedShield</span><span className="crumb-slash">/</span><strong>{pageTitles[location.pathname] || "Overview"}</strong></div>
          <div className="topbar-right">
            <div className={`api-indicator ${apiState}`}><span className="status-dot" />API {apiState}</div>
            <button className="icon-button" aria-label="Activity"><Activity size={17} /></button>
            <button className="icon-button" aria-label="Notifications"><Bell size={17} /><i /></button>
            <button className="profile-button"><span className="avatar">FS</span><span>Local admin</span><ChevronDown size={14} /></button>
          </div>
        </header>
        <div className="content">
          <Suspense fallback={<div className="load-state"><span className="spinner" /> Loading page…</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/network" element={<Network />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/training" element={<Training />} />
              <Route path="/secure-aggregation" element={<SecureAggregation />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
        <footer className="app-footer"><span><CircleHelp size={13} /> FedShield local research environment</span><span>Privacy status is based on verified runtime behavior</span></footer>
      </main>
    </div>
  );
}
