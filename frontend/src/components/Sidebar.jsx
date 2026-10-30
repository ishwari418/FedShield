import { NavLink } from "react-router-dom";
import {
  Activity, BarChart3, Database, FileText, GitBranch, LayoutDashboard,
  LockKeyhole, Network, Settings, ShieldCheck,
} from "lucide-react";

const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/network", label: "Federated network", icon: Network },
  { to: "/clients", label: "Organizations", icon: Database },
  { to: "/training", label: "Model training", icon: Activity },
  { to: "/secure-aggregation", label: "Secure aggregation", icon: LockKeyhole },
  { to: "/analytics", label: "Model analytics", icon: BarChart3 },
  { to: "/privacy", label: "Privacy center", icon: ShieldCheck },
  { to: "/reports", label: "Reports", icon: FileText },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><GitBranch size={19} /></div>
        <div><strong>FedShield</strong><span>FEDERATED INTELLIGENCE</span></div>
      </div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Primary navigation">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-status"><span className="status-dot green" /> Local environment <span className="status-value">Online</span></div>
        <div className="sidebar-footer"><Settings size={15} /> <span>FedShield v1.0</span><span className="footer-tag">LOCAL</span></div>
      </div>
    </aside>
  );
}
