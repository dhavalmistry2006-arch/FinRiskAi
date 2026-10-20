import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Plus,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  api,
  compactMoney,
  date,
  entries,
  identifier,
  money,
  percent,
  useApi,
  type RecordData,
} from "../api";
import {
  Badge,
  Button,
  Card,
  Download,
  Empty,
  ErrorState,
  Loading,
  PageTitle,
} from "../components/ui";
const colors = ["#23a992", "#e4b350", "#f08b52", "#dc6170"];
export const riskColors: Record<string, string> = {
  Low: "#23a992",
  Moderate: "#e4b350",
  Elevated: "#f08b52",
  High: "#dc6170",
  Unassessed: "#a4b0c2",
};
export const normalize = (arr: RecordData[] | undefined) =>
  (arr || []).map((x) => ({
    ...x,
    name: x.name || x.label || x._id || x.date || "Unknown",
    value: x.value ?? x.count ?? x.total ?? 0,
    exposure: x.exposure ?? x.totalExposure ?? x.amount ?? x.value ?? 0,
    count: x.count ?? x.value ?? x.total ?? 0,
  }));
export function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="chart-card">
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
export function BarPlot({
  data,
  valueKey = "value",
  currency = false,
}: {
  data: RecordData[];
  valueKey?: string;
  currency?: boolean;
}) {
  if (!data.length)
    return (
      <Empty
        title="No data for this selection"
        description="Adjust your filters or assess applications to populate this chart."
      />
    );
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--line)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={currency ? compactMoney : undefined}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={currency ? 70 : 32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 10,
            }}
            formatter={currency ? (v) => money(Number(v)) : undefined}
          />
          <Bar
            isAnimationActive={false}
            dataKey={valueKey}
            radius={[5, 5, 0, 0]}
            fill="#4b71c2"
            maxBarSize={36}
          >
            {data.map((item, i) => (
              <Cell key={i} fill={riskColors[item.name] || colors[i % 4]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export default function Dashboard({
  portfolio = false,
}: {
  portfolio?: boolean;
}) {
  const [period, setPeriod] = useState("all");
  const [risk, setRisk] = useState("");
  const [purpose, setPurpose] = useState("");
  const [status, setStatus] = useState("");
  const params = new URLSearchParams();
  if (period !== "all")
    params.set(
      "from",
      new Date(Date.now() - Number(period) * 86400000).toISOString(),
    );
  if (risk) params.set("riskBand", risk);
  if (purpose) params.set("loanPurpose", purpose);
  if (status) params.set("status", status);
  const query = useApi(`/analytics?${params}`);
  const data = query.data;
  const navigate = useNavigate();
  const filterBar = (
    <div className="filter-bar">
      <div className="filter-group">
        <CalendarDays size={15} />
        <select
          aria-label="Date range"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="all">All time</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 12 months</option>
        </select>
        <select
          aria-label="Loan purpose filter"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        >
          <option value="">All purposes</option>
          {[
            "Personal",
            "Home",
            "Education",
            "Business",
            "Vehicle",
            "Other",
          ].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          aria-label="Risk filter"
          value={risk}
          onChange={(e) => setRisk(e.target.value)}
        >
          <option value="">All risk bands</option>
          {["Low", "Moderate", "Elevated", "High"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          aria-label="Status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {[
            "Draft",
            "Assessed",
            "Under Review",
            "Approved by Reviewer",
            "Rejected by Reviewer",
          ].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <span className="data-status">
        <span />
        Live database
      </span>
    </div>
  );
  return (
    <>
      <PageTitle
        eyebrow={
          portfolio
            ? "PORTFOLIO RISK INTELLIGENCE"
            : "YOUR PORTFOLIO. A CLEARER PERSPECTIVE."
        }
        title={portfolio ? "Portfolio Analytics" : "Command Center"}
        description={
          portfolio
            ? "Understand exposure, concentration, and illustrative expected loss."
            : "A connected view of your lending portfolio, risk signals, and review activity."
        }
        actions={
          <>
            <Download path="/reports/portfolio?format=csv">
              <ArrowDownToLine size={15} />
              Export overview
            </Download>
            <Button asChild>
              <Link to="/applications?new=1">
                <Plus size={16} />
                New application
              </Link>
            </Button>
          </>
        }
      />
      <div className="research-banner">
        <Sparkles size={16} />
        <span>
          <strong>Research environment</strong> · All seeded records are
          synthetic. Estimates are illustrative and require human review.
        </span>
        <Link to="/models">
          View model card
          <ArrowUpRight size={14} />
        </Link>
      </div>
      {filterBar}
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : (
        data && (
          <DashboardContent
            data={data}
            portfolio={portfolio}
            onRisk={setRisk}
            navigate={navigate}
          />
        )
      )}
    </>
  );
}
function DashboardContent({
  data,
  portfolio,
  onRisk,
  navigate,
}: {
  data: RecordData;
  portfolio: boolean;
  onRisk: (v: string) => void;
  navigate: (v: string) => void;
}) {
  const k = data.kpis || {};
  const distribution = normalize(data.riskDistribution);
  const total = distribution.reduce((n, x) => n + x.value, 0);
  const volume = normalize(data.volumeOverTime);
  const recent = data.recentApplications || [];
  const metrics = [
    {
      label: "Total applications",
      value: (k.totalApplications ?? 0).toLocaleString(),
      note: "Across the selected portfolio",
      icon: FileText,
    },
    {
      label: "Total loan exposure",
      value: compactMoney(k.totalExposure),
      note: "Requested principal · INR",
      icon: BriefcaseBusiness,
    },
    {
      label: "Under review",
      value: (k.underReview ?? 0).toLocaleString(),
      note: "Awaiting a human decision",
      icon: ShieldAlert,
    },
    {
      label: "Illustrative expected loss",
      value: compactMoney(k.expectedLoss),
      note: `LGD assumption ${percent(data.assumptions?.lgd ?? 0.45)}`,
      icon: ChartNoAxesCombined,
    },
  ];
  return (
    <>
      <div className="metric-grid">
        {metrics.map((m, i) => (
          <Card key={m.label} className="metric-card">
            <div className="metric-top">
              <span>{m.label}</span>
              <span className={`metric-icon metric-icon-${i}`}>
                <m.icon size={17} />
              </span>
            </div>
            <div className="metric-value">{m.value}</div>
            <div className="metric-note">
              <span className="metric-dot" />
              {m.note}
            </div>
          </Card>
        ))}
      </div>
      <div className="dashboard-primary-grid">
        <ChartCard
          title="Application activity"
          subtitle="Loan application volume across the selected period"
          action={
            <span className="chart-key">
              <span />
              Applications
            </span>
          }
        >
          {volume.length ? (
            <div className="chart-container area-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={volume}
                  margin={{ top: 15, right: 12, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#4c78d0"
                        stopOpacity={0.22}
                      />
                      <stop offset="100%" stopColor="#4c78d0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--line)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--muted)", fontSize: 10 }}
                    tickFormatter={(s) => String(s).slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted)", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                    }}
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="count"
                    name="Applications"
                    stroke="#4c78d0"
                    fill="url(#volumeFill)"
                    strokeWidth={2.5}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard
          title="Portfolio risk distribution"
          subtitle="Current model-assessed applications"
          action={<Badge tone="neutral">{total} applications</Badge>}
        >
          {distribution.length ? (
            <>
              <div className="donut-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={distribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={67}
                      outerRadius={89}
                      paddingAngle={4}
                      stroke="none"
                      onClick={(v) => onRisk(v.name)}
                    >
                      {distribution.map((v, i) => (
                        <Cell
                          key={v.name}
                          aria-label={`${v.name}: ${v.value} applications`}
                          fill={riskColors[v.name] || colors[i % 4]}
                          cursor="pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>
                    {k.averageProbability == null
                      ? "—"
                      : percent(k.averageProbability)}
                  </strong>
                  <span>AVG. ESTIMATE</span>
                </div>
              </div>
              <div className="risk-legend">
                {distribution.map((v, i) => (
                  <button key={v.name} onClick={() => onRisk(v.name)}>
                    <span
                      className="legend-dot"
                      style={{
                        background: riskColors[v.name] || colors[i % 4],
                      }}
                    />
                    <span>{v.name}</span>
                    <strong>{v.value}</strong>
                    <small>
                      {total ? Math.round((v.value / total) * 100) : 0}%
                    </small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Empty title="No assessments yet" />
          )}
        </ChartCard>
      </div>
      <div className="secondary-kpis">
        <div>
          <span>Average illustrative risk</span>
          <strong>
            {k.averageProbability == null ? "—" : percent(k.averageProbability)}
          </strong>
          <small>Not a validated real-world PD</small>
        </div>
        <div>
          <span>Reviewer approval rate</span>
          <strong>
            {k.approvalRate == null ? "—" : percent(k.approvalRate)}
          </strong>
          <small>Based on recorded decisions</small>
        </div>
        <div>
          <span>High-risk applications</span>
          <strong>{k.highRisk ?? 0}</strong>
          <small>Prioritize for analyst review</small>
        </div>
        <div>
          <span>Assessed applications</span>
          <strong>{k.assessed ?? 0}</strong>
          <small>Served by the model service</small>
        </div>
      </div>
      <div className="two-column">
        <ChartCard
          title="Exposure by risk band"
          subtitle="Requested loan principal · INR"
        >
          <BarPlot
            data={normalize(data.exposureByRisk)}
            valueKey="exposure"
            currency
          />
        </ChartCard>
        <ChartCard
          title="Loan purpose breakdown"
          subtitle="Understand where your portfolio is concentrated"
        >
          <BarPlot data={normalize(data.loanPurposes)} />
        </ChartCard>
      </div>
      <Card className="table-card">
        <div className="card-heading">
          <div>
            <h2>Recent applications</h2>
            <p>The latest activity in your lending workspace</p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/applications">
              View all applications
              <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
        {recent.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Loan purpose</th>
                  <th>Requested amount</th>
                  <th>Risk band</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((a: RecordData) => (
                  <tr
                    key={identifier(a)}
                    className="clickable-row"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        navigate(`/applications/${identifier(a)}`);
                    }}
                    onClick={() => navigate(`/applications/${identifier(a)}`)}
                  >
                    <td>
                      <div className="applicant-cell">
                        <span className="table-avatar">
                          {a.applicantName
                            ?.split(" ")
                            .map((s: string) => s[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <div>
                          <strong>{a.applicantName}</strong>
                          <small>{a.applicantId}</small>
                        </div>
                      </div>
                    </td>
                    <td>{a.loanPurpose}</td>
                    <td className="number-cell">
                      {money(a.loanAmount, a.currency)}
                    </td>
                    <td>
                      <Badge>
                        {a.latestAssessment?.riskBand ||
                          a.riskBand ||
                          "Unassessed"}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone="neutral">{a.status}</Badge>
                    </td>
                    <td>{date(a.createdAt)}</td>
                    <td>
                      <ChevronRight size={15} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Card>
      <div className="three-column">
        <ChartCard
          title="Credit score distribution"
          subtitle="India-style range · 300–900"
        >
          <BarPlot data={normalize(data.creditDistribution)} />
        </ChartCard>
        <ChartCard
          title="Review outcomes"
          subtitle="Human decisions, separate from model risk"
        >
          <BarPlot data={normalize(data.decisionDistribution)} />
        </ChartCard>
        <ChartCard
          title="Employment segments"
          subtitle="Application composition"
        >
          <BarPlot data={normalize(data.borrowerSegments)} />
        </ChartCard>
      </div>
      <div className="two-column">
        <ChartCard
          title="Portfolio concentration"
          subtitle="Exposure by product category"
        >
          <BarPlot
            data={normalize(data.concentration)}
            valueKey="exposure"
            currency
          />
        </ChartCard>
        <ChartCard
          title="Top model drivers"
          subtitle="Aggregated feature influence, not causal effects"
        >
          <BarPlot data={normalize(data.topRiskDrivers)} />
        </ChartCard>
      </div>
      <ChartCard
        title="Risk estimates over time"
        subtitle="Stored illustrative model estimates by application creation date; no production accuracy is inferred."
      >
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.riskTrend || []}>
              <CartesianGrid
                vertical={false}
                stroke="var(--line)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--muted)", fontSize: 10 }}
                tickFormatter={(v) => String(v).slice(5, 10)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={percent}
                tick={{ fill: "var(--muted)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => percent(Number(v))}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                }}
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="probability"
                name="Illustrative estimate"
                fill="#4b71c222"
                stroke="#4b71c2"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <Card className="methodology">
        <ShieldAlert size={19} />
        <div>
          <strong>How to interpret this workspace</strong>
          <p>
            Expected loss = illustrative model estimate × assumed loss given
            default × requested principal. These are research assumptions, not
            audited forecasts. No protected characteristic is used to make an
            automated lending decision.
          </p>
        </div>
        <Link to="/models">
          Model methodology
          <ArrowUpRight size={14} />
        </Link>
      </Card>
    </>
  );
}
