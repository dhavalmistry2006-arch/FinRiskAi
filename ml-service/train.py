"""Offline reproducible training on an explicitly synthetic research population."""
from pathlib import Path
import hashlib
import json
import os
import platform
import sklearn
from datetime import datetime, timezone
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, average_precision_score, confusion_matrix, brier_score_loss, roc_curve, precision_recall_curve)
from sklearn.calibration import calibration_curve
from sklearn.inspection import permutation_importance
from app.features import FinancialInput, feature_vector, FEATURE_NAMES, FEATURE_VERSION
from app.monitoring import distribution_reference

ROOT = Path(__file__).resolve().parent
SEED = 2026
MODEL_VERSION = 'synthetic-credit-v1.0.0'
LIMITATIONS = 'Synthetic demonstration only. Probability estimates concern a generated illustrative adverse outcome, not validated real borrower default. No regulatory or bureau integration. Human review required; predictions never determine lending decisions.'


def generate(seed=SEED, count=2400):
    rng = np.random.default_rng(seed)
    rows = []
    for i in range(count):
        income = round(float(rng.lognormal(10.9, .65)), 2)
        row = dict(monthlyIncome=income, monthlyExpenses=round(income * rng.uniform(.2, .85), 2),
                   existingDebt=round(income * rng.uniform(0, 18), 2), existingEmi=round(income * rng.uniform(0, .45), 2),
                   creditScore=int(rng.integers(350, 901)), loanAmount=round(income * rng.uniform(2, 36), 2),
                   tenureMonths=int(rng.choice([12, 24, 36, 48, 60, 84, 120])), interestRate=round(float(rng.uniform(6, 24)), 2),
                   employmentMonths=int(rng.integers(0, 241)), employmentType=str(rng.choice(['Salaried', 'Self-employed'])),
                   loanPurpose=str(rng.choice(['Personal', 'Home', 'Education', 'Vehicle', 'Business'])))
        x = feature_vector(FinancialInput(**row))
        # Bernoulli target, *not* observed default. Never included as an input feature.
        logit = -1.6 + 2.1 * x[0] + .8 * x[2] + .35 * x[4] - 3.2 * x[5] - .09 * x[6] + .025 * x[8]
        probability = 1 / (1 + np.exp(-np.clip(logit, -30, 30)))
        row['illustrativeAdverseOutcome'] = int(rng.random() < probability)
        row['syntheticId'] = f'SYN-{i+1:05d}'
        rows.append(row)
    return pd.DataFrame(rows)


def metrics(y, probability):
    predicted = probability >= .5
    fraction, mean = calibration_curve(y, probability, n_bins=8, strategy='quantile')
    fpr, tpr, _ = roc_curve(y, probability)
    precision, recall, _ = precision_recall_curve(y, probability)
    return dict(accuracy=float(accuracy_score(y, predicted)), precision=float(precision_score(y, predicted, zero_division=0)),
                recall=float(recall_score(y, predicted, zero_division=0)), f1=float(f1_score(y, predicted, zero_division=0)),
                rocAuc=float(roc_auc_score(y, probability)), prAuc=float(average_precision_score(y, probability)),
                brierScore=float(brier_score_loss(y, probability)), confusionMatrix=confusion_matrix(y, predicted).tolist(),
                calibration=[dict(predicted=float(p), observed=float(o)) for p, o in zip(mean, fraction)],
                roc=[dict(fpr=float(a), tpr=float(b)) for a, b in zip(fpr[::max(1,len(fpr)//70)], tpr[::max(1,len(tpr)//70)])],
                precisionRecall=[dict(precision=float(a), recall=float(b)) for a, b in zip(precision[::max(1,len(precision)//70)], recall[::max(1,len(recall)//70)])])


def train():
    os.environ.setdefault('OMP_NUM_THREADS', '2')
    frame = generate()
    csv = frame.to_csv(index=False, float_format='%.8f')
    data_dir = ROOT.parent / 'datasets'
    data_dir.mkdir(exist_ok=True)
    (data_dir / 'synthetic-credit-v1.csv').write_text(csv)
    X = np.vstack([feature_vector(FinancialInput(**row)) for row in frame.to_dict('records')])
    y = frame.illustrativeAdverseOutcome.to_numpy()
    indices = np.arange(len(y))
    train_idx, holdout = train_test_split(indices, test_size=.4, stratify=y, random_state=SEED)
    val_idx, test_idx = train_test_split(holdout, test_size=.5, stratify=y[holdout], random_state=SEED)
    candidates = {
        'Logistic Regression': make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=1000, random_state=SEED)),
        'Random Forest': RandomForestClassifier(n_estimators=120, min_samples_leaf=12, max_depth=9, n_jobs=2, random_state=SEED),
        'Gradient Boosting': HistGradientBoostingClassifier(max_iter=100, max_leaf_nodes=12, l2_regularization=4, random_state=SEED),
    }
    comparison = []
    for name, estimator in candidates.items():
        cv = cross_val_score(estimator, X[train_idx], y[train_idx], cv=StratifiedKFold(3, shuffle=True, random_state=SEED), scoring='roc_auc', n_jobs=1)
        estimator.fit(X[train_idx], y[train_idx])
        result = metrics(y[val_idx], estimator.predict_proba(X[val_idx])[:, 1])
        comparison.append(dict(name=name, validation=result, cvRocAucMean=float(cv.mean()), cvRocAucStd=float(cv.std())))
    best = min(comparison, key=lambda item: item['validation']['brierScore'])['name']
    model = candidates[best]
    test_p = model.predict_proba(X[test_idx])[:, 1]
    test_metrics = metrics(y[test_idx], test_p)
    importance = permutation_importance(model, X[test_idx], y[test_idx], n_repeats=8, random_state=SEED, scoring='roc_auc', n_jobs=1)
    # Predictions on held-out employment-duration groups describe only synthetic data.
    groups = []
    for label, mask in [('Employment < 2 years', X[test_idx, 6] < 2), ('Employment ≥ 2 years', X[test_idx, 6] >= 2), ('Income below synthetic median', frame.monthlyIncome.to_numpy()[test_idx] < np.median(frame.monthlyIncome.to_numpy()[train_idx])), ('Income at/above synthetic median', frame.monthlyIncome.to_numpy()[test_idx] >= np.median(frame.monthlyIncome.to_numpy()[train_idx])), ('Credit score below 650', X[test_idx,5] < (650-300)/600), ('Credit score at/above 650', X[test_idx,5] >= (650-300)/600)]:
        if mask.sum() > 10 and len(np.unique(y[test_idx][mask])) == 2:
            groups.append(dict(group=label, count=int(mask.sum()), rocAuc=float(roc_auc_score(y[test_idx][mask],test_p[mask])), brierScore=float(brier_score_loss(y[test_idx][mask],test_p[mask]))))
    metadata = dict(modelId=MODEL_VERSION, modelVersion=MODEL_VERSION, version=MODEL_VERSION, algorithm=best,
                    trainedAt=datetime.now(timezone.utc).isoformat(), datasetVersion='synthetic-credit-v1', synthetic=True,
                    target='Bernoulli-generated illustrative adverse outcome; no observed real defaults',
                    dataset=dict(name='FinRisk synthetic credit v1', rows=len(frame), source='Locally generated using train.py', license='CC0-1.0 for generated synthetic dataset', sha256=hashlib.sha256(csv.encode()).hexdigest(), positiveRate=float(y.mean()), missingValues=0, population='Artificial INR financial profiles; not representative of any lending population'),
                    split=dict(train=len(train_idx), validation=len(val_idx), test=len(test_idx), method='Stratified 60/20/20, seed 2026; no test-set model selection'),
                    seed=SEED, featureVersion=FEATURE_VERSION, features=FEATURE_NAMES, metrics=test_metrics, comparison=comparison,
                    selectionCriterion='Lowest validation Brier score. Test split used once for final evaluation, not selection.',
                    hyperparameters={k:v for k,v in model.get_params().items() if isinstance(v,(int,float,str,bool)) or v is None},
                    featureImportance=[dict(feature=f, importance=float(v), std=float(s)) for f,v,s in zip(FEATURE_NAMES,importance.importances_mean,importance.importances_std)],
                    subgroupPerformance=groups, limitations=LIMITATIONS,
                    fairness='No age, gender, ethnicity or applicant name is used. Employment and financial inputs may proxy protected characteristics. No demographic fairness certification is possible without representative lawful group labels.',
                    riskPolicy=dict(version='demo-bands-v1', thresholds=[.15,.35,.6], bands=['Low','Moderate','Elevated','High']),
                    referenceDistributions={f:dict(mean=float(X[train_idx,j].mean()),std=float(X[train_idx,j].std()),p05=float(np.quantile(X[train_idx,j],.05)),p95=float(np.quantile(X[train_idx,j],.95)),histogram=distribution_reference(X[train_idx,j])) for j,f in enumerate(FEATURE_NAMES)},
                    predictionReference=distribution_reference(model.predict_proba(X[train_idx])[:,1]),
                    runtime=dict(python=platform.python_version(),sklearn=sklearn.__version__,numpy=np.__version__),
                    trainingConfig=dict(seed=SEED,rows=len(frame),cvFolds=3,featureVersion=FEATURE_VERSION,candidateAlgorithms=list(candidates),selectionMetric='validation Brier score'),
                    artifact='artifacts/model.joblib', deploymentStatus='research-demo')
    artifact_dir = ROOT / 'artifacts'
    artifact_dir.mkdir(exist_ok=True)
    joblib.dump(dict(model=model, background=X[train_idx][:100], featureNames=FEATURE_NAMES), artifact_dir / 'model.joblib')
    metadata['artifactSha256'] = hashlib.sha256((artifact_dir / 'model.joblib').read_bytes()).hexdigest()
    metadata['trainingConfigSha256'] = hashlib.sha256(json.dumps(metadata['trainingConfig'],sort_keys=True).encode()).hexdigest()
    (artifact_dir / 'metadata.json').write_text(json.dumps(metadata, indent=2, allow_nan=False))
    fig, ax = plt.subplots(figsize=(6,4))
    ax.plot([0,1],[0,1], '--', color='gray', label='Perfect calibration')
    ax.plot([r['predicted'] for r in test_metrics['calibration']], [r['observed'] for r in test_metrics['calibration']], 'o-', label=best)
    ax.set(xlabel='Predicted synthetic outcome probability', ylabel='Observed synthetic outcome fraction', title='Held-out synthetic calibration')
    ax.legend(); fig.tight_layout(); fig.savefig(artifact_dir / 'calibration.png', dpi=140); plt.close(fig)
    print(json.dumps(dict(selected=best, test={k:v for k,v in test_metrics.items() if isinstance(v,float)}, rows=len(frame)),indent=2))
    return metadata

if __name__ == '__main__':
    train()
