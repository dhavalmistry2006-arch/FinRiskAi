import { useEffect, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  date,
  entries,
  identifier,
  money,
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
import {
  ApplicationForm,
  type ApplicationInputs,
} from "../components/ApplicationForm";
import { useUser } from "../session";
export default function Applications() {
  return (
    <Routes>
      <Route index element={<ApplicationList />} />
      <Route path=":id" element={<ApplicationDetail />} />
    </Routes>
  );
}
function ApplicationList() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useUser();
  const [search, setSearch] = useState(params.get("search") || "");
  const [debounced, setDebounced] = useState(search);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [riskBand, setRiskBand] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const open = params.get("new") === "1";
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    setSearch(params.get("search") || "");
  }, [params.get("search")]);
  const query = useApi(
    `/applications?page=${page}&limit=10&search=${encodeURIComponent(debounced)}&status=${encodeURIComponent(status)}&sort=${sort}&direction=desc&riskBand=${riskBand}`,
  );
  const items = entries(query.data);
  const canWrite = ["Administrator", "Risk Analyst"].includes(user.role);
  const save = async (values: ApplicationInputs) => {
    setBusy(true);
    try {
      const app = await api(
        "/applications",
        send("POST", { ...values, status: "Draft" }),
      );
      toast.success("Application saved as draft");
      queryClient.invalidateQueries();
      setParams({});
      navigate(`/applications/${identifier(app)}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        title="Loan Applications"
        eyebrow="YOUR LENDING WORKSPACE"
        description="Manage applications from first draft to a documented human decision."
        actions={
          <>
            <Download path="/reports/applications?format=csv" />
            {canWrite && (
              <Button onClick={() => setParams({ new: "1" })}>
                <Plus size={16} />
                New application
              </Button>
            )}
          </>
        }
      />
      <Card className="table-card">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search applicants"
              placeholder="Search by name or applicant ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Application status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {[
              "Draft",
              "Submitted",
              "Processing",
              "Assessed",
              "Under Review",
              "Approved by Reviewer",
              "Rejected by Reviewer",
              "Withdrawn",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            aria-label="Application risk band"
            value={riskBand}
            onChange={(e) => {
              setRiskBand(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All risk bands</option>
            {["Low", "Moderate", "Elevated", "High"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            aria-label="Sort applications"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="createdAt">Newest first</option>
            <option value="loanAmount">Highest loan amount</option>
            <option value="updatedAt">Recently updated</option>
          </select>
          <span className="muted">{query.data?.total ?? 0} applications</span>
        </div>
        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Purpose</th>
                  <th>Loan amount</th>
                  <th>Risk estimate</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={identifier(a)}>
                    <td>
                      <Link
                        className="applicant-cell"
                        to={`/applications/${identifier(a)}`}
                      >
                        <span className="table-avatar">
                          {a.applicantName?.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <strong>{a.applicantName}</strong>
                          <small>{a.applicantId}</small>
                        </span>
                      </Link>
                    </td>
                    <td>{a.loanPurpose || "—"}</td>
                    <td className="number-cell">
                      {money(a.loanAmount, a.currency)}
                    </td>
                    <td>
                      {a.latestAssessment ? (
                        <>
                          <Badge>{a.latestAssessment.riskBand}</Badge>
                          <small className="block muted">
                            {percent(a.latestAssessment.probability)}{" "}
                            illustrative
                          </small>
                        </>
                      ) : (
                        <span className="muted">Not assessed</span>
                      )}
                    </td>
                    <td>
                      <Badge tone="neutral">{a.status}</Badge>
                    </td>
                    <td>{date(a.createdAt)}</td>
                    <td>
                      <Link
                        className="icon-button"
                        aria-label={`View ${a.applicantName}`}
                        to={`/applications/${identifier(a)}`}
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching applications"
            description="Try another search, clear your filters, or create a new draft."
          />
        )}
        <div className="pagination">
          <span>
            Page {page} of {query.data?.pages || 1}
          </span>
          <div>
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={14} />
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page >= (query.data?.pages || 1)}
              onClick={() => setPage(page + 1)}
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Card>
      <Modal
        title="New loan application"
        open={open}
        onOpenChange={(v) => setParams(v ? { new: "1" } : {})}
      >
        <ApplicationForm onSubmit={save} busy={busy} />
      </Modal>
    </>
  );
}
function ApplicationDetail() {
  const { id } = useParams();
  const query = useApi(`/applications/${id}`);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useUser();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState("Under Review");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const a = query.data;
  const canWrite = ["Administrator", "Risk Analyst"].includes(user.role);
  const canReview = ["Administrator", "Reviewer"].includes(user.role);
  async function action(path: string, body?: RecordData) {
    setBusy(true);
    try {
      await api(`/applications/${id}${path}`, send("POST", body));
      toast.success(
        path === "/assess"
          ? "Assessment saved from the model service"
          : "Application updated",
      );
      queryClient.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  if (!a) return null;
  return (
    <>
      <Link className="back-link" to="/applications">
        <ArrowLeft size={15} />
        All applications
      </Link>
      <PageTitle
        title={a.applicantName}
        eyebrow={a.applicantId}
        description={`Created ${date(a.createdAt)} · ${a.loanPurpose || "Purpose not set"} loan · ${a.currency || "INR"}`}
        actions={
          <>
            <Download path={`/reports/assessment?format=pdf&id=${id}`}>
              Assessment PDF
            </Download>
            {canWrite &&
              ["Draft", "Assessed", "Under Review"].includes(a.status) && (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil size={15} />
                  Edit application
                </Button>
              )}
          </>
        }
      />
      <div className="detail-overview">
        <Card>
          <span className="eyebrow">REQUESTED LOAN</span>
          <h2 className="large-number">{money(a.loanAmount, a.currency)}</h2>
          <p>
            {a.tenureMonths} months · {a.interestRate}% annual assumption
          </p>
        </Card>
        <Card>
          <span className="eyebrow">APPLICATION STATUS</span>
          <div className="detail-badge">
            <Badge tone="neutral">{a.status}</Badge>
          </div>
          <p>Model assessment and reviewer decision are separate.</p>
        </Card>
        <Card>
          <span className="eyebrow">CURRENT RISK BAND</span>
          <div className="detail-badge">
            <Badge>{a.latestAssessment?.riskBand || "Unassessed"}</Badge>
          </div>
          <p>
            {a.latestAssessment
              ? `${percent(a.latestAssessment.probability)} illustrative outcome estimate`
              : "Submit to run a real model prediction."}
          </p>
        </Card>
      </div>
      <div className="two-column detail-columns">
        <Card>
          <div className="card-heading">
            <h2>Applicant profile</h2>
            <Badge tone="neutral">Synthetic record</Badge>
          </div>
          <dl className="data-list">
            {[
              ["Monthly income", money(a.monthlyIncome, a.currency)],
              ["Monthly expenses", money(a.monthlyExpenses, a.currency)],
              ["Existing debt", money(a.existingDebt, a.currency)],
              ["Existing monthly EMI", money(a.existingEmi, a.currency)],
              [
                "Credit score",
                a.creditScore ? `${a.creditScore} / 900` : "Not provided",
              ],
              [
                "Employment",
                `${a.employmentType || "—"} · ${a.employmentMonths || 0} months`,
              ],
              ["Age eligibility", `${a.age || "—"} years`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {canWrite && (
            <div className="workflow-actions">
              {a.status === "Draft" && (
                <Button disabled={busy} onClick={() => action("/submit")}>
                  <ArrowRight size={15} />
                  Submit application
                </Button>
              )}
              {["Submitted", "Assessed", "Under Review"].includes(a.status) && (
                <Button disabled={busy} onClick={() => action("/assess")}>
                  <BrainCircuit size={16} />
                  {busy
                    ? "Running model…"
                    : a.latestAssessment
                      ? "Reassess application"
                      : "Run assessment"}
                </Button>
              )}
              {![
                "Approved by Reviewer",
                "Rejected by Reviewer",
                "Withdrawn",
                "Processing",
              ].includes(a.status) && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => action("/withdraw")}
                >
                  Withdraw
                </Button>
              )}
            </div>
          )}
        </Card>
        <Card>
          <div className="card-heading">
            <h2>Assessment intelligence</h2>
            <BrainCircuit size={18} />
          </div>
          {a.latestAssessment ? (
            <AssessmentSummary result={a.latestAssessment} />
          ) : (
            <Empty
              title="Ready when you are"
              description="Submit the application, then run an assessment. Predictions come from the Python model service and are saved here."
            />
          )}
        </Card>
      </div>
      {canReview && ["Assessed", "Under Review"].includes(a.status) && (
        <Card>
          <div className="card-heading">
            <div>
              <h2>Human review</h2>
              <p>
                A documented reviewer decision is required. Model risk does not
                approve or deny credit.
              </p>
            </div>
            <ShieldCheck size={20} />
          </div>
          <form
            className="review-form"
            onSubmit={(e) => {
              e.preventDefault();
              action("/decision", { decision, reason });
            }}
          >
            <Field label="Reviewer decision">
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                {[
                  "Under Review",
                  "Approved by Reviewer",
                  "Rejected by Reviewer",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Review reasoning">
              <textarea
                required
                minLength={10}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Document the evidence and reasoning for this decision…"
              />
            </Field>
            <Button type="submit" disabled={busy}>
              <Check size={15} />
              Record decision
            </Button>
          </form>
        </Card>
      )}
      <Card className="table-card">
        <div className="card-heading">
          <div>
            <h2>Assessment history</h2>
            <p>Versioned model outputs retained for traceability</p>
          </div>
        </div>
        {a.assessments?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Assessed</th>
                  <th>Model version</th>
                  <th>Risk estimate</th>
                  <th>Band</th>
                  <th>Review priority</th>
                </tr>
              </thead>
              <tbody>
                {a.assessments.map((r: RecordData) => (
                  <tr key={identifier(r)}>
                    <td>{date(r.createdAt)}</td>
                    <td>
                      <code>{r.modelVersion}</code>
                    </td>
                    <td>{percent(r.probability)}</td>
                    <td>
                      <Badge>{r.riskBand}</Badge>
                    </td>
                    <td>{r.reviewPriority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No historical assessments" />
        )}
      </Card>
      <Card>
        <div className="card-heading">
          <h2>Application history</h2>
          <Link to="/audit">
            View complete audit trail
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="timeline">
          {(a.history || []).map((event: RecordData, i: number) => (
            <div key={i}>
              <span className="timeline-dot" />
              <div>
                <strong>
                  {event.action || event.state || event.status || event.event}
                </strong>
                <p>
                  {event.reason ||
                    event.details ||
                    event.message ||
                    "State change recorded"}
                </p>
                <small>
                  {date(event.at || event.timestamp || event.createdAt)}{" "}
                  {event.actorName || event.actor || ""}
                </small>
              </div>
            </div>
          ))}
        </div>
        {!a.history?.length && (
          <p className="muted">
            All changes are recorded in the central audit trail.
          </p>
        )}
      </Card>
      {canWrite && a.status === "Draft" && (
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={14} />
          Delete demonstration application
        </Button>
      )}
      <Modal title="Edit application" open={editing} onOpenChange={setEditing}>
        <ApplicationForm
          initial={a as Partial<ApplicationInputs>}
          busy={busy}
          onSubmit={async (values) => {
            setBusy(true);
            try {
              await api(`/applications/${id}`, send("PATCH", values));
              setEditing(false);
              toast.success(
                "Application updated; review the latest inputs before reassessing",
              );
              queryClient.invalidateQueries();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Modal>
      <Modal
        title="Delete application?"
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      >
        <p>
          This deletes the demonstration application and its assessment records.
          Its audit trail is retained.
        </p>
        <Button
          variant="danger"
          onClick={async () => {
            try {
              await api(`/applications/${id}`, send("DELETE"));
              toast.success("Application deleted");
              queryClient.invalidateQueries();
              navigate("/applications");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          Confirm deletion
        </Button>
      </Modal>
    </>
  );
}
export function AssessmentSummary({ result }: { result: RecordData }) {
  const r = result;
  return (
    <div className="assessment-summary">
      <div className="assessment-score">
        <div>
          <span className="eyebrow">ILLUSTRATIVE RISK ESTIMATE</span>
          <strong>{percent(r.probability)}</strong>
          <span>Research model · not a validated real-world PD</span>
        </div>
        <Badge>{r.riskBand}</Badge>
      </div>
      <div className="score-track">
        <span style={{ width: `${(r.probability || 0) * 100}%` }} />
      </div>
      <div className="ratio-grid">
        {[
          ["New EMI", money(r.ratios?.emi)],
          ["EMI / income", percent(r.ratios?.emiToIncome)],
          ["Total debt service / income", percent(r.ratios?.dti)],
          ["Disposable income", money(r.ratios?.disposableIncome)],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="model-version">
        Model <code>{r.modelVersion}</code> · Priority: {r.reviewPriority}
      </p>
      {r.warnings?.map((w: string) => (
        <p className="warning-note" key={w}>
          {w}
        </p>
      ))}
      {r.contributions?.length > 0 && (
        <div className="contributions">
          <h3>Key contributing features</h3>
          {[...r.contributions]
            .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
            .slice(0, 5)
            .map((c: RecordData) => (
              <div className="contribution-row" key={c.feature}>
                <span>{c.feature.replace(/_/g, " ")}</span>
                <div>
                  <span
                    className={c.contribution > 0 ? "increases" : "decreases"}
                    style={{
                      width: `${Math.min(100, Math.abs(c.contribution) * 100)}%`,
                    }}
                  />
                </div>
                <strong
                  className={c.contribution > 0 ? "text-risk" : "text-safe"}
                >
                  {c.contribution > 0 ? "+" : ""}
                  {Number(c.contribution).toFixed(3)}
                </strong>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
