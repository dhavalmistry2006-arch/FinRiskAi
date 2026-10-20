import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BrainCircuit,
  ChartNoAxesCombined,
  FlaskConical,
  GitBranch,
  Info,
  Play,
  Save,
  ShieldCheck,
  Sparkles,
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
  PageTitle,
} from "../components/ui";
import {
  ApplicationForm,
  defaults,
  type ApplicationInputs,
} from "../components/ApplicationForm";
import { AssessmentSummary } from "./Applications";
import { BarPlot, ChartCard } from "./Dashboard";
import { useUser } from "../session";
export function financials(input: RecordData) {
  const p = Number(input.loanAmount) || 0,
    n = Number(input.tenureMonths) || 1,
    r = (Number(input.interestRate) || 0) / 1200;
  const emi =
    r === 0 ? p / n : (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const income = Number(input.monthlyIncome) || 0;
  return {
    emi,
    totalRepayment: emi * n,
    totalInterest: emi * n - p,
    emiToIncome: income ? (emi + Number(input.existingEmi || 0)) / income : 0,
    expenseToIncome: income ? Number(input.monthlyExpenses || 0) / income : 0,
    disposableIncome:
      income -
      Number(input.monthlyExpenses || 0) -
      Number(input.existingEmi || 0) -
      emi,
  };
}
export default function Intelligence({
  mode,
}: {
  mode: "assessment" | "explainability" | "scenarios" | "models";
}) {
  if (mode === "models") return <Models />;
  if (mode === "scenarios") return <Scenarios />;
  return <Assessment explain={mode === "explainability"} />;
}
function Assessment({ explain }: { explain: boolean }) {
  const apps = useApi("/applications?limit=100");
  const [selected, setSelected] = useState("");
  const detail = useApi(`/applications/${selected}`, { enabled: !!selected });
  const [busy, setBusy] = useState(false);
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const query = useQueryClient();
  const user = useUser();
  const a = detail.data;
  const result = a?.latestAssessment;
  return (
    <>
      <PageTitle
        title={explain ? "Explainable AI" : "AI Risk Assessment"}
        eyebrow={explain ? "EVERY SIGNAL, EXPLAINED" : "FROM INPUTS TO INSIGHT"}
        description={
          explain
            ? "Trace individual predictions to actual model feature contributions."
            : "A transparent workspace for reproducible, model-backed credit risk research."
        }
      />
      <div className="research-banner">
        <Info size={16} />
        <span>
          Illustrative synthetic adverse-outcome probability. This model is not
          validated for real lending decisions.
        </span>
      </div>
      <Card>
        <div className="assessment-selector">
          <div>
            <h2>Select an application</h2>
            <p>
              Run and retain assessments against the actual application record.
            </p>
          </div>
          <Field label="Application">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose a demonstration application…</option>
              {entries(apps.data).map((a) => (
                <option value={identifier(a)} key={identifier(a)}>
                  {a.applicantName} · {a.applicantId}
                </option>
              ))}
            </select>
          </Field>
          <Button asChild variant="secondary">
            <Link to="/applications?new=1">
              Create application
              <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
        {apps.error && <ErrorState error={apps.error} />}
      </Card>
      {selected ? (
        detail.isLoading ? (
          <Loading />
        ) : detail.error ? (
          <ErrorState error={detail.error} />
        ) : (
          a && (
            <>
              <div className="two-column">
                <Card>
                  <div className="card-heading">
                    <div>
                      <h2>{a.applicantName}</h2>
                      <p>
                        {a.applicantId} · {a.loanPurpose} ·{" "}
                        {money(a.loanAmount, a.currency)}
                      </p>
                    </div>
                    <Badge tone="neutral">{a.status}</Badge>
                  </div>
                  <dl className="data-list">
                    {[
                      ["Monthly income", money(a.monthlyIncome)],
                      ["Monthly expenses", money(a.monthlyExpenses)],
                      ["Existing EMI", money(a.existingEmi)],
                      ["Requested principal", money(a.loanAmount)],
                      [
                        "Tenure / annual interest",
                        `${a.tenureMonths} months / ${a.interestRate}%`,
                      ],
                      [
                        "Credit score",
                        a.creditScore
                          ? `${a.creditScore} / 900`
                          : "Not provided",
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="workflow-actions">
                    {["Administrator", "Risk Analyst"].includes(user.role) &&
                      [
                        "Draft",
                        "Submitted",
                        "Assessed",
                        "Under Review",
                      ].includes(a.status) && (
                        <Button
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              if (a.status === "Draft")
                                await api(
                                  `/applications/${selected}/submit`,
                                  send("POST"),
                                );
                              await api(
                                `/applications/${selected}/assess`,
                                send("POST"),
                              );
                              query.invalidateQueries();
                              toast.success("Prediction and explanation saved");
                            } catch (e) {
                              toast.error((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <BrainCircuit size={16} />
                          {busy
                            ? "Running model…"
                            : result
                              ? "Reassess application"
                              : "Run risk assessment"}
                        </Button>
                      )}
                    <Button asChild variant="secondary">
                      <Link to={`/applications/${selected}`}>
                        View application
                      </Link>
                    </Button>
                  </div>
                </Card>
                <Card>
                  <div className="card-heading">
                    <h2>
                      {explain
                        ? "Local model explanation"
                        : "Assessment result"}
                    </h2>
                    {result && (
                      <Download
                        path={`/reports/assessment?format=pdf&id=${selected}`}
                      >
                        PDF
                      </Download>
                    )}
                  </div>
                  {result ? (
                    <AssessmentSummary result={result} />
                  ) : (
                    <Empty
                      title="No prediction stored"
                      description="Run an assessment to receive a prediction, computed financial ratios, and genuine model explanations."
                    />
                  )}
                </Card>
              </div>
              {result && (
                <Card>
                  <div className="card-heading">
                    <div>
                      <h2>Understanding the explanation</h2>
                      <p>
                        Model contributions explain the prediction, not the
                        causes of a borrower’s outcome.
                      </p>
                    </div>
                    <GitBranch size={20} />
                  </div>
                  <div className="explanation-grid">
                    <div>
                      <span className="eyebrow">
                        INCREASING THE MODEL ESTIMATE
                      </span>
                      {result.contributions
                        ?.filter((c: RecordData) => c.contribution > 0)
                        .sort(
                          (a: RecordData, b: RecordData) =>
                            b.contribution - a.contribution,
                        )
                        .slice(0, 4)
                        .map((c: RecordData) => (
                          <p key={c.feature}>
                            <strong>{c.feature.replace(/_/g, " ")}</strong>
                            <span className="text-risk">
                              {" "}
                              +{c.contribution.toFixed(3)}
                            </span>
                          </p>
                        ))}
                    </div>
                    <div>
                      <span className="eyebrow">
                        DECREASING THE MODEL ESTIMATE
                      </span>
                      {result.contributions
                        ?.filter((c: RecordData) => c.contribution < 0)
                        .sort(
                          (a: RecordData, b: RecordData) =>
                            a.contribution - b.contribution,
                        )
                        .slice(0, 4)
                        .map((c: RecordData) => (
                          <p key={c.feature}>
                            <strong>{c.feature.replace(/_/g, " ")}</strong>
                            <span className="text-safe">
                              {" "}
                              {c.contribution.toFixed(3)}
                            </span>
                          </p>
                        ))}
                    </div>
                    <div>
                      <span className="eyebrow">TRACEABILITY</span>
                      <p>
                        Method:{" "}
                        {result.explanation?.method || "Model contribution"}
                      </p>
                      <p>
                        Scale: {result.explanation?.scale || "See model card"}
                      </p>
                      <p>
                        Model: <code>{result.modelVersion}</code>
                      </p>
                      <p>No uncertainty interval is claimed.</p>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )
        )
      ) : (
        <Card>
          <Empty
            title="Start with an application"
            description="Choose a saved record above. Every result is served by the ML service and persisted to MongoDB."
          />
        </Card>
      )}
      <Card>
        <div className="card-heading">
          <div>
            <h2>
              <Sparkles size={17} />
              FinRisk Research Assistant
            </h2>
            <p>
              Deterministic explanations grounded in stored data. No records
              leave this platform.
            </p>
          </div>
          <Badge tone="neutral">No external LLM</Badge>
        </div>
        <form
          className="copilot-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await api(
                "/copilot",
                send("POST", {
                  question: copilotQuestion,
                  applicationId: selected || undefined,
                }),
              );
              setAnswer(r.answer);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <input
            aria-label="Research question"
            value={copilotQuestion}
            onChange={(e) => setCopilotQuestion(e.target.value)}
            required
            placeholder="Explain this application's estimated risk…"
          />
          <Button type="submit">
            Ask assistant
            <ArrowRight size={14} />
          </Button>
        </form>
        {answer && <div className="assistant-answer">{answer}</div>}
      </Card>
    </>
  );
}
function Scenarios() {
  const apps = useApi("/applications?limit=100");
  const saved = useApi("/scenarios?limit=20");
  const [selected, setSelected] = useState("");
  const detail = useApi(`/applications/${selected}`, { enabled: !!selected });
  const [inputs, setInputs] = useState<RecordData>({
    ...defaults,
    applicantName: "Scenario applicant",
    applicantId: "SCENARIO",
  });
  const [baseline, setBaseline] = useState<RecordData>({
    ...defaults,
    applicantName: "Scenario applicant",
    applicantId: "SCENARIO",
  });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RecordData>();
  const query = useQueryClient();
  const user = useUser();
  useEffect(() => {
    if (detail.data) {
      setInputs({ ...detail.data });
      setBaseline({ ...detail.data });
      setResult(undefined);
    }
  }, [detail.data]);
  const f = financials(inputs),
    b = financials(baseline);
  const ranges = [
    ["monthlyIncome", "Monthly income", 10000, 500000, 1000],
    ["monthlyExpenses", "Monthly expenses", 0, 300000, 1000],
    ["existingEmi", "Existing monthly EMI", 0, 100000, 500],
    ["loanAmount", "Requested loan amount", 10000, 5000000, 10000],
    ["tenureMonths", "Loan tenure (months)", 6, 240, 6],
    ["interestRate", "Annual interest (%)", 0, 30, 0.5],
    ["existingDebt", "Existing debt", 0, 2000000, 10000],
  ] as const;
  const curve = [12, 24, 36, 48, 60, 84, 120].map((n) => ({
    name: `${n}m`,
    emi: Math.round(financials({ ...inputs, tenureMonths: n }).emi),
  }));
  return (
    <>
      <PageTitle
        title="Scenario Simulator"
        eyebrow="EXPLORE THE WHAT-IFS"
        description="Test financial assumptions and compare model responses without changing the original application."
      />
      <div className="research-banner">
        <FlaskConical size={16} />
        <span>
          Hypothetical changes are not guarantees of approval. Financial
          calculations update locally; model comparisons run through FastAPI.
        </span>
      </div>
      <div className="two-column scenario-grid">
        <Card>
          <div className="card-heading">
            <h2>Scenario inputs</h2>
            <Badge tone="neutral">Interactive</Badge>
          </div>
          <Field label="Baseline application">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Custom illustrative inputs</option>
              {entries(apps.data).map((a) => (
                <option key={identifier(a)} value={identifier(a)}>
                  {a.applicantName}
                </option>
              ))}
            </select>
          </Field>
          <div className="scenario-sliders">
            {ranges.map(([key, label, min, max, step]) => (
              <label className="slider-field" key={key}>
                <span>
                  {label}
                  <strong>
                    {key === "tenureMonths"
                      ? `${inputs[key]} months`
                      : key === "interestRate"
                        ? `${inputs[key]}%`
                        : money(inputs[key])}
                  </strong>
                </span>
                <input
                  type="range"
                  aria-label={label}
                  min={min}
                  max={max}
                  step={step}
                  value={inputs[key] || 0}
                  onChange={(e) => {
                    setInputs({ ...inputs, [key]: Number(e.target.value) });
                    setResult(undefined);
                  }}
                />
                <div>
                  <small>{min.toLocaleString("en-IN")}</small>
                  <small>{max.toLocaleString("en-IN")}</small>
                </div>
              </label>
            ))}
          </div>
          <Field label="Scenario name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lower principal, longer tenure"
              maxLength={120}
            />
          </Field>
          <div className="workflow-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setInputs({ ...baseline });
                setResult(undefined);
              }}
            >
              Reset to baseline
            </Button>
            {["Administrator", "Risk Analyst"].includes(user.role) && (
              <Button
                disabled={busy || !name.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api(
                      "/scenarios",
                      send("POST", {
                        name,
                        applicationId: selected || undefined,
                        inputs,
                        baselineInputs: baseline,
                      }),
                    );
                    setResult(r);
                    toast.success("Scenario assessed and saved");
                    query.invalidateQueries({
                      queryKey: ["/scenarios?limit=20"],
                    });
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Save size={14} />
                {busy ? "Comparing models…" : "Compare & save"}
              </Button>
            )}
          </div>
        </Card>
        <div className="scenario-results">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Financial impact</h2>
                <p>Computed from your current assumptions</p>
              </div>
              <ChartNoAxesCombined size={19} />
            </div>
            <div className="scenario-emi">
              <span>Estimated monthly EMI</span>
              <strong>{money(f.emi)}</strong>
              <small>
                Baseline {money(b.emi)} · Difference {money(f.emi - b.emi)}
              </small>
            </div>
            <div className="ratio-grid">
              {[
                ["Total repayment", money(f.totalRepayment)],
                ["Total interest", money(f.totalInterest)],
                ["Total EMI / income", percent(f.emiToIncome)],
                ["Disposable income", money(f.disposableIncome)],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p
              className={f.disposableIncome < 0 ? "warning-note" : "info-note"}
            >
              {f.disposableIncome < 0
                ? "The current assumptions produce negative disposable income."
                : "Affordability depends on complete records and a human review."}
            </p>
          </Card>
          <ChartCard
            title="EMI across loan tenures"
            subtitle="Same principal and annual interest assumption"
          >
            <BarPlot
              data={curve.map((x) => ({ ...x, value: x.emi }))}
              currency
            />
          </ChartCard>
          {result && (
            <Card>
              <h2>Model comparison</h2>
              <div className="scenario-comparison">
                <div>
                  <span>Baseline</span>
                  <strong>{percent(result.baseline?.probability)}</strong>
                  <Badge>{result.baseline?.riskBand}</Badge>
                </div>
                <ArrowRight />
                <div>
                  <span>Modified</span>
                  <strong>{percent(result.result?.probability)}</strong>
                  <Badge>{result.result?.riskBand}</Badge>
                </div>
              </div>
              <p className="muted">
                Illustrative synthetic adverse-outcome probabilities ·{" "}
                {result.result?.modelVersion}
              </p>
              <Download
                path={`/reports/scenarios?format=pdf&id=${identifier(result)}`}
              >
                Export scenario
              </Download>
            </Card>
          )}
        </div>
      </div>
      <Card className="table-card">
        <div className="card-heading">
          <h2>Saved scenario comparisons</h2>
          <Download path="/reports/scenarios?format=csv" />
        </div>
        {saved.isLoading ? (
          <Loading />
        ) : saved.error ? (
          <ErrorState error={saved.error} />
        ) : entries(saved.data).length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Created</th>
                  <th>Baseline estimate</th>
                  <th>Modified estimate</th>
                  <th>Risk band</th>
                  <th>Export</th>
                </tr>
              </thead>
              <tbody>
                {entries(saved.data).map((s) => (
                  <tr key={identifier(s)}>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => {
                          setInputs(s.inputs);
                          setBaseline(s.baselineInputs || s.inputs);
                          setResult(s);
                          setName(s.name);
                        }}
                      >
                        {s.name}
                      </button>
                    </td>
                    <td>{date(s.createdAt)}</td>
                    <td>{percent(s.baseline?.probability)}</td>
                    <td>{percent(s.result?.probability)}</td>
                    <td>
                      <Badge>{s.result?.riskBand}</Badge>
                    </td>
                    <td>
                      <Download
                        path={`/reports/scenarios?format=pdf&id=${identifier(s)}`}
                      >
                        PDF
                      </Download>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No saved scenarios"
            description="Adjust assumptions, name the scenario, then compare and save."
          />
        )}
      </Card>
    </>
  );
}
function Curve({ data, x, y }: { data: RecordData[]; x: string; y: string }) {
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey={x}
            domain={[0, 1]}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
          />
          <YAxis
            type="number"
            domain={[0, 1]}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey={y}
            stroke="#4c78d0"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
function Models() {
  const monitoring = useApi("/monitoring");
  const q = useApi("/model");
  const d = q.data;
  const m = d?.metrics;
  return (
    <>
      <PageTitle
        title="Model Intelligence"
        eyebrow="TRANSPARENT BY DESIGN"
        description="Inspect the deployed research model, its training provenance, and held-out evaluation."
        actions={
          <Download path="/reports/model?format=pdf">Model report</Download>
        }
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        d && (
          <>
            <div className="research-banner">
              <ShieldCheck size={16} />
              <span>
                Synthetic-only evaluation. These metrics do not establish
                performance or fairness on real borrowers.
              </span>
            </div>
            <div className="detail-overview">
              <Card>
                <span className="eyebrow">DEPLOYED MODEL</span>
                <h2>{d.algorithm}</h2>
                <code>{d.modelVersion || d.version}</code>
                <p>Trained {date(d.trainedAt)}</p>
              </Card>
              <Card>
                <span className="eyebrow">DATASET</span>
                <h2>{d.dataset?.name}</h2>
                <p>
                  {d.dataset?.rows?.toLocaleString()} synthetic records ·{" "}
                  {d.dataset?.license}
                </p>
                <p>Positive class {percent(d.dataset?.positiveRate)}</p>
              </Card>
              <Card>
                <span className="eyebrow">MODEL GOVERNANCE</span>
                <h2>Operator controlled</h2>
                <p>
                  Retraining is offline and requires explicit operator action.
                  No automatic deployment.
                </p>
                <Badge tone="neutral">Research candidate</Badge>
              </Card>
            </div>
            <div className="model-metric-grid">
              {[
                ["ROC-AUC", m?.rocAuc],
                ["PR-AUC", m?.prAuc],
                ["Accuracy", m?.accuracy],
                ["Precision", m?.precision],
                ["Recall", m?.recall],
                ["F1", m?.f1],
                ["Brier score", m?.brierScore],
              ].map(([name, value]) => (
                <Card key={name as string}>
                  <span>{name}</span>
                  <strong>
                    {typeof value === "number" ? value.toFixed(3) : "—"}
                  </strong>
                </Card>
              ))}
            </div>
            <div className="three-column">
              <ChartCard
                title="ROC curve"
                subtitle="Held-out synthetic test split"
              >
                <Curve data={m?.roc || []} x="fpr" y="tpr" />
              </ChartCard>
              <ChartCard
                title="Precision–recall"
                subtitle="Imbalanced-class discrimination"
              >
                <Curve
                  data={m?.precisionRecall || []}
                  x="recall"
                  y="precision"
                />
              </ChartCard>
              <ChartCard
                title="Calibration assessment"
                subtitle="Predicted versus observed synthetic outcome"
              >
                <Curve data={m?.calibration || []} x="predicted" y="observed" />
              </ChartCard>
            </div>
            <div className="two-column">
              <ChartCard
                title="Global feature influence"
                subtitle="Relative model importance, not causal impact"
              >
                <BarPlot
                  data={(d.featureImportance || [])
                    .slice(0, 8)
                    .map((f: RecordData) => ({
                      name: f.feature.replace(/_/g, " "),
                      value: f.importance,
                    }))}
                />
              </ChartCard>
              <Card>
                <div className="card-heading">
                  <h2>Confusion matrix</h2>
                  <p>Actual rows · predicted columns</p>
                </div>
                <div className="confusion-matrix">
                  <span />
                  <span>Predicted 0</span>
                  <span>Predicted 1</span>
                  <span>Actual 0</span>
                  <strong>{m?.confusionMatrix?.[0]?.[0] ?? "—"}</strong>
                  <strong>{m?.confusionMatrix?.[0]?.[1] ?? "—"}</strong>
                  <span>Actual 1</span>
                  <strong>{m?.confusionMatrix?.[1]?.[0] ?? "—"}</strong>
                  <strong>{m?.confusionMatrix?.[1]?.[1] ?? "—"}</strong>
                </div>
                <p className="muted">
                  Target 1 is the documented synthetic adverse outcome, not
                  independently observed loan default.
                </p>
              </Card>
            </div>
            <Card className="table-card">
              <div className="card-heading">
                <h2>Model comparison</h2>
                <p>Reproducible candidate evaluation</p>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Validation ROC-AUC</th>
                      <th>Validation PR-AUC</th>
                      <th>Brier score</th>
                      <th>CV ROC-AUC mean</th>
                      <th>CV std</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.comparison?.map((c: RecordData) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td>{c.validation?.rocAuc?.toFixed(3)}</td>
                        <td>{c.validation?.prAuc?.toFixed(3)}</td>
                        <td>{c.validation?.brierScore?.toFixed(3)}</td>
                        <td>{c.cvRocAucMean?.toFixed(3)}</td>
                        <td>{c.cvRocAucStd?.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <div className="card-heading">
                <div>
                  <h2>Model registry & provenance</h2>
                  <p>
                    Reproducible training metadata for the deployed artifact
                  </p>
                </div>
                <Badge tone="neutral">{d.deploymentStatus || "Research"}</Badge>
              </div>
              <dl className="data-list">
                <div>
                  <dt>Model identifier</dt>
                  <dd>
                    <code>{d.modelId}</code>
                  </dd>
                </div>
                <div>
                  <dt>Dataset version</dt>
                  <dd>
                    <code>{d.datasetVersion}</code>
                  </dd>
                </div>
                <div>
                  <dt>Feature version / seed</dt>
                  <dd>
                    {d.featureVersion} / {d.seed}
                  </dd>
                </div>
                <div>
                  <dt>Artifact</dt>
                  <dd>
                    <code>
                      {typeof d.artifact === "string"
                        ? d.artifact
                        : JSON.stringify(d.artifact)}
                    </code>
                  </dd>
                </div>
                <div>
                  <dt>Artifact SHA-256</dt>
                  <dd>
                    <code>{d.artifactSha256}</code>
                  </dd>
                </div>
                <div>
                  <dt>Selection criterion</dt>
                  <dd>{d.selectionCriterion}</dd>
                </div>
                <div>
                  <dt>Hyperparameters</dt>
                  <dd>
                    <code>{JSON.stringify(d.hyperparameters)}</code>
                  </dd>
                </div>
              </dl>
            </Card>
            <Card className="table-card">
              <div className="card-heading">
                <div>
                  <h2>Input & prediction distribution monitoring</h2>
                  <p>
                    PSI against the synthetic training reference; distribution
                    shift does not measure accuracy.
                  </p>
                </div>
                <Button variant="ghost" onClick={() => monitoring.refetch()}>
                  Refresh monitoring
                </Button>
              </div>
              {monitoring.isLoading ? (
                <Loading />
              ) : monitoring.error ? (
                <ErrorState error={monitoring.error} />
              ) : !monitoring.data?.available ? (
                <Empty
                  title="More data needed"
                  description={monitoring.data?.note}
                />
              ) : (
                <>
                  <div className="monitoring-summary">
                    <span>
                      {monitoring.data?.count} stored complete applications
                    </span>
                    <strong>
                      Prediction PSI:{" "}
                      {Number(monitoring.data?.predictionPsi || 0).toFixed(3)}
                    </strong>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Feature</th>
                          <th>Population stability index</th>
                          <th>Descriptive indicator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monitoring.data?.featureDrift?.map((f: RecordData) => (
                          <tr key={f.feature}>
                            <td>{f.feature.replace(/_/g, " ")}</td>
                            <td>{Number(f.psi).toFixed(3)}</td>
                            <td>
                              <Badge>{f.indicator}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="monitoring-summary">
                    <p>{monitoring.data?.note}</p>
                  </div>
                </>
              )}
            </Card>
            <Card>
              <h2>Limitations & responsible use</h2>
              <ul className="limitation-list">
                {(Array.isArray(d.limitations)
                  ? d.limitations
                  : [d.limitations || "Not validated for real-world lending"]
                ).map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="muted">
                No production accuracy trends are reported because real labeled
                outcomes are unavailable. No sensitive demographic subgroup
                guarantees are made.
              </p>
            </Card>
          </>
        )
      )}
    </>
  );
}
