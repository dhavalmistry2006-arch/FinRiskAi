import { motion, useReducedMotion } from "framer-motion";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Bell,
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  Command,
  FileBarChart,
  Fingerprint,
  FlaskConical,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, send, useApi, type RecordData } from "./api";
import { Button, ErrorState, Loading } from "./components/ui";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Applications = lazy(() => import("./pages/Applications"));
const Intelligence = lazy(() => import("./pages/Intelligence"));
const Operations = lazy(() => import("./pages/Operations"));
import { UserContext, useUser } from "./session";
const navigation: {
  group: string;
  items: [string, string, typeof LayoutDashboard][];
}[] = [
  {
    group: "WORKSPACE",
    items: [
      ["/", "Command Center", LayoutDashboard],
      ["/applications", "Loan Applications", FolderOpen],
      ["/assessment", "AI Risk Assessment", BrainCircuit],
      ["/explainability", "Explainable AI", GitBranch],
    ],
  },
  {
    group: "INTELLIGENCE",
    items: [
      ["/portfolio", "Portfolio Analytics", ChartNoAxesCombined],
      ["/scenarios", "Scenario Simulator", FlaskConical],
      ["/batch", "Batch Risk Analysis", Upload],
      ["/models", "Model Intelligence", Activity],
    ],
  },
  {
    group: "MANAGEMENT",
    items: [
      ["/alerts", "Risk Alerts", Bell],
      ["/reports", "Reports & Exports", FileBarChart],
      ["/audit", "Audit Trail", Fingerprint],
      ["/administration", "Administration", Settings2],
    ],
  },
];
export default function App() {
  const session = useApi("/auth/me", { retry: false });
  const user =
    session.data?.user || (session.data?.email ? session.data : undefined);
  if (session.isLoading)
    return (
      <div className="initial-loading">
        <ShieldCheck size={36} />
        <Loading />
      </div>
    );
  if (!user) {
    if (
      session.error &&
      "status" in session.error &&
      session.error.status !== 401
    )
      return (
        <main className="login-page">
          <ErrorState error={session.error} retry={() => session.refetch()} />
        </main>
      );
    return <Login />;
  }
  return (
    <UserContext.Provider value={user}>
      <Shell />
    </UserContext.Provider>
  );
}
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <main className="login-page">
      <div className="login-intro">
        <div className="brand">
          <span className="brand-symbol">
            <ChartNoAxesCombined size={25} />
          </span>
          <span>
            FinRisk<span className="brand-ai"> AI</span>
            <small>INTELLIGENCE PLATFORM</small>
          </span>
        </div>
        <div className="login-copy">
          <div className="eyebrow">CREDIT INTELLIGENCE, REIMAGINED</div>
          <h1>
            A clearer view
            <br />
            of financial risk.
          </h1>
          <p>
            Understand the signals. Explore the possibilities.
            <br />
            Keep every decision explainable.
          </p>
          <div className="login-feature">
            <ShieldCheck />
            Human review at the center
          </div>
          <div className="login-feature">
            <GitBranch />
            Transparent, reproducible models
          </div>
          <div className="login-feature">
            <Activity />
            Connected portfolio intelligence
          </div>
        </div>
        <p className="login-disclaimer">
          Educational research platform · Synthetic demonstration data
        </p>
      </div>
      <div className="login-panel">
        <div className="login-form">
          <span className="badge tone-low">FINRISK AI 2.0</span>
          <h2>Welcome to your workspace</h2>
          <p>Sign in to access your risk intelligence platform.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("/auth/login", send("POST", { email, password }));
                await query.invalidateQueries({ queryKey: ["/auth/me"] });
                if (location.pathname === "/login") navigate("/");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>Email address</span>
              <input
                autoFocus
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@example.com"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={busy} type="submit">
              {busy ? "Signing in…" : "Sign in to workspace"}
              <ArrowUpRight size={16} />
            </Button>
          </form>
          <p className="login-help">
            Use the account configured by your administrator. Local demo
            credentials are generated during setup; they are never embedded in
            the application.
          </p>
        </div>
        <p className="login-footer">
          Intelligent Credit Risk. Explainable Decisions. Smarter Lending.
        </p>
      </div>
    </main>
  );
}
function Shell() {
  const reducedMotion = useReducedMotion();
  const user = useUser();
  const query = useQueryClient();
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("finrisk-theme") === "dark",
  );
  const [search, setSearch] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("finrisk-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => setMobile(false), [location.pathname]);
  const title =
    navigation
      .flatMap((g) => g.items)
      .find((i) => i[0] === location.pathname)?.[1] || "Application details";
  return (
    <div className="app-layout">
      {mobile && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <NavLink to="/" className="brand">
          <span className="brand-symbol">
            <ChartNoAxesCombined size={24} />
          </span>
          <span>
            FinRisk<span className="brand-ai"> AI</span>
            <small>INTELLIGENCE PLATFORM</small>
          </span>
          <span className="version">2.0</span>
        </NavLink>
        <div className="workspace-picker">
          <span className="workspace-icon">F</span>
          <div>
            <strong>Research workspace</strong>
            <small>Synthetic demonstration</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.group}>
              <div className="nav-heading">{group.group}</div>
              {group.items.map(([path, label, Icon]) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === "/"}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {path === "/assessment" && (
                    <span className="nav-ai" aria-hidden="true">
                      AI
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Built for responsible research</strong>
              <p>
                Model signals inform human review. They never decide lending
                outcomes.
              </p>
            </div>
          </div>
          <button
            className="profile"
            onClick={() => navigate("/administration")}
          >
            <span className="avatar">
              {(user.name || "User")
                .split(" ")
                .map((n: string) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </span>
            <Settings2 size={15} />
          </button>
        </div>
      </aside>
      <div className="main-layout">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/applications?search=${encodeURIComponent(search)}`);
                setSearch("");
              }}
            >
              <Search size={15} />
              <input
                aria-label="Search applications"
                placeholder="Search applications…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <span className="environment-pill">
              <span />
              Research
            </span>
            <button
              className="icon-button"
              aria-label={dark ? "Use light mode" : "Use dark mode"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NavLink
              to="/alerts"
              className="icon-button"
              aria-label="Risk alerts"
            >
              <Bell size={18} />
            </NavLink>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await api("/auth/logout", send("POST"));
                  query.clear();
                  window.location.assign("/");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="content">
          <motion.div
            key={location.pathname}
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/applications/*" element={<Applications />} />
                <Route
                  path="/assessment"
                  element={<Intelligence mode="assessment" />}
                />
                <Route
                  path="/explainability"
                  element={<Intelligence mode="explainability" />}
                />
                <Route path="/portfolio" element={<Dashboard portfolio />} />
                <Route
                  path="/scenarios"
                  element={<Intelligence mode="scenarios" />}
                />
                <Route
                  path="/models"
                  element={<Intelligence mode="models" />}
                />
                <Route path="/batch" element={<Operations mode="batch" />} />
                <Route path="/alerts" element={<Operations mode="alerts" />} />
                <Route
                  path="/reports"
                  element={<Operations mode="reports" />}
                />
                <Route path="/audit" element={<Operations mode="audit" />} />
                <Route
                  path="/administration"
                  element={<Operations mode="administration" />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </motion.div>
          <footer className="workspace-footer">
            <span>
              <ShieldCheck size={13} />
              Synthetic data · Research use only
            </span>
            <span>
              FinRisk AI 2.0 <span className="footer-dot">·</span> Human
              judgment, amplified
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
