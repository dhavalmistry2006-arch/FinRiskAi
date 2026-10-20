import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Filter,
  Fingerprint,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Upload,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  api,
  date,
  entries,
  identifier,
  percent,
  send,
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
  Field,
  Loading,
  Modal,
  PageTitle,
} from "../components/ui";
import { useUser } from "../session";
export default function Operations({
  mode,
}: {
  mode: "batch" | "alerts" | "reports" | "audit" | "administration";
}) {
  if (mode === "batch") return <Batch />;
  if (mode === "alerts") return <Alerts />;
  if (mode === "reports") return <Reports />;
  if (mode === "audit") return <Audit />;
  return <Administration />;
}
const columns = [
  "applicantName",
  "applicantId",
  "age",
  "employmentType",
  "employmentMonths",
  "monthlyIncome",
  "monthlyExpenses",
  "existingDebt",
  "existingEmi",
  "creditScore",
  "loanPurpose",
  "loanAmount",
  "tenureMonths",
  "interestRate",
  "currency",
];
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
function Batch() {
  const user = useUser();
  const queryClient = useQueryClient();
  const jobs = useApi("/batches?limit=20");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string[][]>([]);
  const [previewErrors, setPreviewErrors] = useState<RecordData[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState("");
  const job = useApi(`/batches/${jobId}`, {
    enabled: !!jobId,
    refetchInterval: (query: RecordData) =>
      ["Queued", "Processing", "queued", "processing"].includes(
        query.state.data?.status,
      )
        ? 1500
        : false,
  });
  const d = job.data;
  useEffect(() => {
    if (
      d &&
      [
        "Completed",
        "Completed with errors",
        "Failed",
        "completed",
        "failed",
      ].includes(d.status)
    )
      queryClient.invalidateQueries({ queryKey: ["/batches?limit=20"] });
  }, [d?.status]);
  const choose = async (f: File | undefined) => {
    setFile(f);
    setPreview([]);
    setPreviewErrors([]);
    setPreviewTotal(0);
    setMapping({});
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Upload must be 5 MB or smaller");
      setFile(undefined);
      return;
    }
    if (!/\.(csv|xlsx)$/i.test(f.name)) {
      toast.error("Only CSV and XLSX files are supported");
      setFile(undefined);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const result = await api("/batches/preview", { method: "POST", body });
      const rows = [result.headers, ...result.rows];
      setPreview(rows);
      setPreviewErrors(result.errors || []);
      setPreviewTotal(result.total || 0);
      setMapping(
        Object.fromEntries(
          columns.filter((c) => result.headers.includes(c)).map((c) => [c, c]),
        ),
      );
    } catch (error) {
      setFile(undefined);
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        title="Batch Risk Analysis"
        eyebrow="FROM DATASET TO DECISIONS SUPPORT"
        description="Validate, assess, and retain multiple synthetic applications with row-level error reporting."
        actions={
          <Download path="/reports/batches?format=csv">Export jobs</Download>
        }
      />
      <div className="two-column">
        <Card>
          <div className="card-heading">
            <div>
              <h2>Upload a dataset</h2>
              <p>CSV or XLSX · Up to 5 MB · Maximum 500 rows</p>
            </div>
            <Upload size={20} />
          </div>
          <label className="upload-zone">
            <span className="upload-icon">
              <Upload size={25} />
            </span>
            <strong>{file?.name || "Choose your dataset"}</strong>
            <span>Use synthetic applicant data only</span>
            <input
              aria-label="Upload batch file"
              type="file"
              accept=".csv,.xlsx"
              disabled={
                !["Administrator", "Risk Analyst"].includes(user.role) || busy
              }
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
          <p className="muted">
            Required columns match application field names. A sample is
            available in <code>datasets/batch-example.csv</code>. XLSX uses the
            first worksheet and matching headers.
          </p>
          {preview.length > 0 && (
            <>
              <p className="preview-validation">
                <strong>{previewTotal} rows found</strong> ·{" "}
                {previewErrors.length
                  ? `${previewErrors.length} rows need attention before or during processing`
                  : "Default field validation passed"}
                .
              </p>
              {previewErrors.length > 0 && (
                <details className="batch-errors">
                  <summary>
                    Inspect invalid rows (mapping is applied during processing)
                  </summary>
                  {previewErrors
                    .slice(0, 10)
                    .map((e: RecordData, i: number) => (
                      <p key={i}>
                        <strong>Row {e.row}</strong>: {e.message}{" "}
                        {e.issues?.fieldErrors &&
                          Object.keys(e.issues.fieldErrors).join(", ")}
                      </p>
                    ))}
                </details>
              )}
              <h3>Column mapping</h3>
              <div className="mapping-grid">
                {columns.map((c) => (
                  <Field key={c} label={c}>
                    <select
                      value={mapping[c] || ""}
                      onChange={(e) =>
                        setMapping({ ...mapping, [c]: e.target.value })
                      }
                    >
                      <option value="">Use default / missing</option>
                      {preview[0].map((h, i) => (
                        <option key={`${h}-${i}`}>{h}</option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            </>
          )}
          {file && (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const body = new FormData();
                  body.append("file", file);
                  if (Object.keys(mapping).length)
                    body.append(
                      "mapping",
                      JSON.stringify(
                        Object.fromEntries(
                          Object.entries(mapping).filter(
                            ([, source]) => source,
                          ),
                        ),
                      ),
                    );
                  const r = await api("/batches", { method: "POST", body });
                  setJobId(identifier(r));
                  toast.success("Batch queued for validation and analysis");
                  queryClient.invalidateQueries({
                    queryKey: ["/batches?limit=20"],
                  });
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <PlayIcon />
              {busy ? "Uploading…" : "Validate & analyze dataset"}
            </Button>
          )}
        </Card>
        <Card>
          <div className="card-heading">
            <h2>Processing progress</h2>
            <Badge tone="neutral">Background job</Badge>
          </div>
          {!jobId ? (
            <Empty
              title="No batch selected"
              description="Upload a dataset or select a stored job below to inspect progress."
            />
          ) : job.isLoading ? (
            <Loading />
          ) : job.error ? (
            <ErrorState error={job.error} />
          ) : (
            d && (
              <>
                <div className="job-status">
                  <Badge>{d.status}</Badge>
                  <strong>
                    {d.processed || 0} / {d.total || 0} rows
                  </strong>
                </div>
                <progress
                  aria-label="Batch processing progress"
                  value={d.processed || 0}
                  max={d.total || 1}
                />
                <div className="ratio-grid">
                  <div>
                    <small>Successful records</small>
                    <strong>{d.results?.length || 0}</strong>
                  </div>
                  <div>
                    <small>Invalid / failed rows</small>
                    <strong>{d.errors?.length || 0}</strong>
                  </div>
                </div>
                {d.errors?.length > 0 && (
                  <div className="batch-errors">
                    <h3>Row-level errors</h3>
                    {d.errors.slice(0, 20).map((e: RecordData, i: number) => (
                      <p key={i}>
                        <strong>Row {e.row ?? i + 1}</strong>:{" "}
                        {e.message || e.error || JSON.stringify(e.errors)}
                      </p>
                    ))}
                  </div>
                )}
                {d.results?.length > 0 && (
                  <Download path={`/batches/${jobId}/download`}>
                    Download assessments
                  </Download>
                )}
              </>
            )
          )}
        </Card>
      </div>
      {preview.length > 1 && (
        <Card className="table-card">
          <div className="card-heading">
            <h2>Dataset preview</h2>
            <p>First five rows · values will be validated on the server</p>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {preview[0].map((c, i) => (
                    <th key={i}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(1).map((row, i) => (
                  <tr key={i}>
                    {row.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Card className="table-card">
        <div className="card-heading">
          <h2>Batch job history</h2>
          <Button variant="ghost" onClick={() => jobs.refetch()}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>
        {jobs.isLoading ? (
          <Loading />
        ) : jobs.error ? (
          <ErrorState error={jobs.error} />
        ) : entries(jobs.data).length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Successful</th>
                  <th>Errors</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries(jobs.data).map((j) => (
                  <tr key={identifier(j)}>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => setJobId(identifier(j))}
                      >
                        {j.filename || j.name || identifier(j).slice(-8)}
                      </button>
                    </td>
                    <td>{date(j.createdAt)}</td>
                    <td>
                      <Badge>{j.status}</Badge>
                    </td>
                    <td>
                      {j.processed || 0}/{j.total || 0}
                    </td>
                    <td>{j.results?.length ?? j.successCount ?? "—"}</td>
                    <td>{j.errors?.length ?? j.errorCount ?? "—"}</td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => setJobId(identifier(j))}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No batch jobs yet" />
        )}
      </Card>
    </>
  );
}
function PlayIcon() {
  return <Upload size={15} />;
}
function Alerts() {
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const q = useApi(`/alerts?limit=100&status=${status}&severity=${severity}`);
  const query = useQueryClient();
  const user = useUser();
  async function action(id: string, action: string) {
    try {
      await api(`/alerts/${id}/${action}`, send("POST"));
      query.invalidateQueries();
      toast.success(
        action === "resolve" ? "Alert resolved" : "Alert acknowledged",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        title="Risk Alerts"
        eyebrow="SIGNALS THAT DESERVE ATTENTION"
        description="Review actionable rules-based alerts, acknowledge ownership, and record resolution."
      />
      <div className="filter-bar">
        <div className="filter-group">
          <Filter size={15} />
          <select
            aria-label="Alert status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {["Open", "Acknowledged", "Resolved"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            aria-label="Alert severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">All severities</option>
            {["High", "Medium", "Low", "Critical", "Warning", "Info"].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </div>
        <Button variant="ghost" onClick={() => q.refetch()}>
          <RefreshCw size={14} />
          Refresh alerts
        </Button>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : entries(q.data).length ? (
        <div className="alerts-list">
          {entries(q.data).map((a) => (
            <Card key={identifier(a)} className="alert-card">
              <span className={`alert-icon ${a.severity?.toLowerCase()}`}>
                <AlertTriangle size={19} />
              </span>
              <div className="alert-copy">
                <div>
                  <h2>{a.title || a.category}</h2>
                  <Badge>{a.severity}</Badge>
                  <Badge tone="neutral">{a.status}</Badge>
                </div>
                <p>{a.message}</p>
                <small>
                  {a.category} · {date(a.createdAt)}
                  {a.applicationId && (
                    <>
                      {" "}
                      ·{" "}
                      <Link
                        to={`/applications/${typeof a.applicationId === "string" ? a.applicationId : identifier(a.applicationId)}`}
                      >
                        View application
                      </Link>
                    </>
                  )}
                </small>
                {a.history?.length > 0 && (
                  <details className="alert-history">
                    <summary>Alert history ({a.history.length})</summary>
                    {a.history.map((h: RecordData, i: number) => (
                      <p key={i}>
                        {h.action} · {h.actor} · {date(h.at)}
                      </p>
                    ))}
                  </details>
                )}
              </div>
              {user.role !== "Read-Only Viewer" && (
                <div className="alert-actions">
                  {a.status === "Open" && (
                    <Button
                      variant="secondary"
                      onClick={() => action(identifier(a), "acknowledge")}
                    >
                      <Check size={14} />
                      Acknowledge
                    </Button>
                  )}
                  {a.status !== "Resolved" && (
                    <Button
                      variant="ghost"
                      onClick={() => action(identifier(a), "resolve")}
                    >
                      <CheckCheck size={15} />
                      Resolve
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            title="All clear for this selection"
            description="Alerts are generated by application assessments and batch activity. Adjust your filters to see resolved signals."
          />
        </Card>
      )}
    </>
  );
}
function Reports() {
  const [format, setFormat] = useState("pdf");
  const [app, setApp] = useState("");
  const [scenario, setScenario] = useState("");
  const [batch, setBatch] = useState("");
  const apps = useApi("/applications?limit=100");
  const scenarios = useApi("/scenarios?limit=100");
  const batches = useApi("/batches?limit=100");
  const user = useUser();
  const canExport = user.role !== "Read-Only Viewer";
  const reports = [
    [
      "assessment",
      "Individual risk assessment",
      "Prediction, financial ratios, feature contributions, model version, and methodology.",
      BrainIcon,
    ],
    [
      "applications",
      "Loan application summary",
      "A complete summary of actual stored applications and their current states.",
      FileText,
    ],
    [
      "portfolio",
      "Portfolio analytics",
      "Exposure, concentration, and illustrative expected-loss assumptions.",
      FileBarChart,
    ],
    [
      "model",
      "Model performance",
      "Training provenance, candidate evaluation, and research limitations.",
      ShieldCheck,
    ],
    [
      "scenarios",
      "Scenario comparison",
      "Saved baseline and modified financial assumptions and model estimates.",
      FlaskIcon,
    ],
    [
      "batches",
      "Batch assessment",
      "Stored batch jobs, success counts, failures, and model outputs.",
      FileSpreadsheet,
    ],
    [
      "audit",
      "Audit activity",
      "Traceable records of application changes and platform activity.",
      Fingerprint,
    ],
  ] as const;
  return (
    <>
      <PageTitle
        title="Reports & Exports"
        eyebrow="INSIGHT, READY TO SHARE"
        description="Generate reports from actual system records with methodology notes and research limitations."
      />
      <Card>
        <div className="report-options">
          <Field label="Export format">
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="pdf">PDF document</option>
              <option value="csv">CSV spreadsheet</option>
              <option value="xlsx">Excel workbook</option>
            </select>
          </Field>
          <Field label="Application for individual report">
            <select value={app} onChange={(e) => setApp(e.target.value)}>
              <option value="">Select an application…</option>
              {entries(apps.data).map((a) => (
                <option key={identifier(a)} value={identifier(a)}>
                  {a.applicantName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scenario">
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              <option value="">All scenarios</option>
              {entries(scenarios.data).map((a) => (
                <option key={identifier(a)} value={identifier(a)}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Batch">
            <select value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="">All batches</option>
              {entries(batches.data).map((a) => (
                <option key={identifier(a)} value={identifier(a)}>
                  {a.filename || a.name || identifier(a).slice(-8)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>
      {!canExport && (
        <div className="research-banner">
          <ShieldCheck size={16} />
          Exports require a Risk Analyst, Reviewer, or Administrator role.
        </div>
      )}
      <div className="reports-grid">
        {reports.map(([type, title, description, Icon]) => {
          const id =
            type === "assessment"
              ? app
              : type === "scenarios"
                ? scenario
                : type === "batches"
                  ? batch
                  : "";
          const disabled = !canExport || (type === "assessment" && !app);
          return (
            <Card key={type}>
              <span className="report-icon">
                <Icon size={24} />
              </span>
              <h2>{title}</h2>
              <p>{description}</p>
              <div className="report-card-footer">
                <span className="badge tone-neutral">
                  {format.toUpperCase()}
                </span>
                {disabled ? (
                  <Button variant="secondary" disabled>
                    {!canExport ? "Restricted" : "Select application"}
                  </Button>
                ) : (
                  <Download
                    path={`/reports/${type}?format=${format}${id ? `&id=${id}` : ""}`}
                  >
                    Generate report
                  </Download>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
function BrainIcon() {
  return <FileBarChart size={24} />;
}
function FlaskIcon() {
  return <FileSpreadsheet size={24} />;
}
function Audit() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useApi(
    `/audit?page=${page}&limit=20&search=${encodeURIComponent(search)}`,
  );
  return (
    <>
      <PageTitle
        title="Audit Trail"
        eyebrow="ACCOUNTABILITY AT EVERY STEP"
        description="A timestamped record of authentication, application changes, assessments, reviews, and exports."
        actions={<Download path="/reports/audit?format=csv" />}
      />
      <Card className="table-card">
        <div className="table-toolbar">
          <Fingerprint size={18} />
          <strong>{q.data?.total || 0} recorded events</strong>
          <input
            aria-label="Search audit events"
            placeholder="Filter activity…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} />
        ) : entries(q.data).length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Activity</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>Details</th>
                  <th>Request ID</th>
                </tr>
              </thead>
              <tbody>
                {entries(q.data).map((e) => (
                  <tr key={identifier(e)}>
                    <td>{new Date(e.createdAt).toLocaleString("en-IN")}</td>
                    <td>
                      <Badge tone="neutral">{e.action}</Badge>
                    </td>
                    <td>
                      {e.actorName ||
                        e.userId?.name ||
                        e.actor?.name ||
                        e.actorId ||
                        "System"}
                    </td>
                    <td>
                      {e.entityType || e.entity || e.resource || "—"}
                      <small className="block muted">
                        {e.entityId?.slice?.(-8) || ""}
                      </small>
                    </td>
                    <td className="audit-details">
                      {typeof e.details === "string"
                        ? e.details
                        : JSON.stringify(e.details || {})}
                    </td>
                    <td>
                      <code>{e.requestId?.slice(0, 12) || "—"}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No matching audit events" />
        )}
        <div className="pagination">
          <span>
            Page {page} of {q.data?.pages || 1}
          </span>
          <div>
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page >= (q.data?.pages || 1)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
function Administration() {
  const user = useUser();
  const isAdmin = user.role === "Administrator";
  const settings = useApi("/settings");
  const users = useApi("/users?limit=100", { enabled: isAdmin });
  const [policy, setPolicy] = useState<RecordData>();
  const [newOpen, setNewOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "Risk Analyst",
  });
  const [busy, setBusy] = useState(false);
  const query = useQueryClient();
  useEffect(() => {
    if (settings.data) setPolicy(settings.data);
  }, [settings.data]);
  return (
    <>
      <PageTitle
        title="Administration"
        eyebrow="PLATFORM GOVERNANCE"
        description="Manage workspace access and versioned research policy assumptions."
      />
      <div className="two-column">
        <Card>
          <div className="card-heading">
            <h2>Your profile</h2>
            <ShieldCheck size={19} />
          </div>
          <dl className="data-list">
            <div>
              <dt>Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                <Badge tone="neutral">{user.role}</Badge>
              </dd>
            </div>
            <div>
              <dt>Data context</dt>
              <dd>Synthetic research records</dd>
            </div>
          </dl>
          <p className="muted">
            Access is enforced on the server. Export, review, and administrative
            permissions are granted by role.
          </p>
        </Card>
        <Card>
          <div className="card-heading">
            <h2>Risk policy assumptions</h2>
            <Badge tone="neutral">{policy?.version || "Loading"}</Badge>
          </div>
          {settings.error ? (
            <ErrorState error={settings.error} />
          ) : policy ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api("/settings", send("PATCH", policy));
                  query.invalidateQueries();
                  toast.success("Versioned policy saved");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="form-grid">
                {[
                  "Low → Moderate",
                  "Moderate → Elevated",
                  "Elevated → High",
                ].map((label, i) => (
                  <Field label={`${label} threshold`} key={label}>
                    <input
                      type="number"
                      min="0.01"
                      max="0.99"
                      step="0.01"
                      required
                      disabled={!isAdmin}
                      value={policy.thresholds?.[i] ?? [0.15, 0.35, 0.6][i]}
                      onChange={(e) => {
                        const thresholds = [
                          ...(policy.thresholds || [0.15, 0.35, 0.6]),
                        ];
                        thresholds[i] = Number(e.target.value);
                        setPolicy({ ...policy, thresholds });
                      }}
                    />
                  </Field>
                ))}
                <Field label="Illustrative LGD assumption">
                  <input
                    disabled={!isAdmin}
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={policy.lgd}
                    onChange={(e) =>
                      setPolicy({ ...policy, lgd: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="EMI-to-income alert threshold">
                  <input
                    disabled={!isAdmin}
                    type="number"
                    min="0"
                    max="2"
                    step="0.05"
                    value={policy.emiAlertThreshold}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        emiAlertThreshold: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={policy.notifications ?? true}
                    onChange={(e) =>
                      setPolicy({ ...policy, notifications: e.target.checked })
                    }
                  />
                  Generate rules-based alerts
                </label>
              </div>
              <p className="muted">
                Demonstration thresholds are not regulatory standards. Model
                records retain the version used at assessment time.
              </p>
              {isAdmin && (
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving policy…" : "Save policy"}
                </Button>
              )}
            </form>
          ) : (
            <Loading />
          )}
        </Card>
      </div>
      {isAdmin ? (
        <Card className="table-card">
          <div className="card-heading">
            <div>
              <h2>Workspace access</h2>
              <p>Least-privilege roles for a human-centered review workflow</p>
            </div>
            <Button onClick={() => setNewOpen(true)}>
              <UserPlus size={15} />
              Add user
            </Button>
          </div>
          {users.isLoading ? (
            <Loading />
          ) : users.error ? (
            <ErrorState error={users.error} />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Access control</th>
                  </tr>
                </thead>
                <tbody>
                  {entries(users.data).map((u) => (
                    <tr key={identifier(u)}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          aria-label={`Role for ${u.name}`}
                          disabled={identifier(u) === identifier(user)}
                          value={u.role}
                          onChange={async (e) => {
                            try {
                              await api(
                                `/users/${identifier(u)}`,
                                send("PATCH", { role: e.target.value }),
                              );
                              query.invalidateQueries();
                              toast.success("User role updated");
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          {[
                            "Administrator",
                            "Risk Analyst",
                            "Reviewer",
                            "Read-Only Viewer",
                          ].map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <Badge>
                          {u.active === false ? "Disabled" : "Active"}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          disabled={identifier(u) === identifier(user)}
                          onClick={async () => {
                            try {
                              await api(
                                `/users/${identifier(u)}`,
                                send("PATCH", { active: u.active === false }),
                              );
                              query.invalidateQueries();
                              toast.success("User access updated");
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          {u.active === false
                            ? "Enable access"
                            : "Disable access"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div className="empty-state">
            <ShieldCheck size={30} />
            <h3>Administrator access required</h3>
            <p>Only administrators can manage users and change risk policy.</p>
          </div>
        </Card>
      )}
      <Modal
        title="Add workspace user"
        open={newOpen}
        onOpenChange={setNewOpen}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/users", send("POST", newUser));
              setNewOpen(false);
              setNewUser({
                name: "",
                email: "",
                password: "",
                role: "Risk Analyst",
              });
              query.invalidateQueries();
              toast.success("User created");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {(["name", "email", "password"] as const).map((k) => (
            <Field
              key={k}
              label={
                k === "password"
                  ? "Initial password (minimum 12 characters)"
                  : k === "name"
                    ? "Full name"
                    : "Email address"
              }
            >
              <input
                type={k === "name" ? "text" : k}
                required
                minLength={k === "password" ? 12 : k === "name" ? 2 : 3}
                value={newUser[k]}
                onChange={(e) =>
                  setNewUser({ ...newUser, [k]: e.target.value })
                }
              />
            </Field>
          ))}
          <Field label="Role">
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              {[
                "Administrator",
                "Risk Analyst",
                "Reviewer",
                "Read-Only Viewer",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={busy}>
            Create user
          </Button>
        </form>
      </Modal>
    </>
  );
}
