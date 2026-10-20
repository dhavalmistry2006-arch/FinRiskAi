"""Inference-only service. Training is an explicit offline operator action."""
from contextlib import asynccontextmanager
from pathlib import Path
import json
import hashlib
import os
import logging
import secrets
from typing import Any
import joblib
import numpy as np
import shap
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sklearn.pipeline import Pipeline
from .features import FinancialInput, calculate_ratios, feature_vector, risk_band, FEATURE_NAMES
from .monitoring import population_stability_index

ROOT = Path(__file__).resolve().parents[1]
logger = logging.getLogger('finrisk.ml')
state: dict[str, Any] = {}


def load_model():
    info = json.loads((ROOT / 'artifacts' / 'metadata.json').read_text())
    artifact_path = ROOT / 'artifacts' / 'model.joblib'
    if hashlib.sha256(artifact_path.read_bytes()).hexdigest() != info.get('artifactSha256'):
        raise ValueError('Model artifact checksum does not match its registered metadata')
    bundle = joblib.load(artifact_path)
    model = bundle['model']
    if isinstance(model, Pipeline):
        background = model[0].transform(bundle['background'])
        explainer = shap.LinearExplainer(model[-1], background)
        scale = 'log-odds'
    else:
        explainer = shap.TreeExplainer(model)
        scale = 'probability' if info['algorithm'] == 'Random Forest' else 'log-odds'
    state.update(model=model, info=info, explainer=explainer, scale=scale)


@asynccontextmanager
async def lifespan(app):
    state.clear()
    try:
        load_model()
    except (FileNotFoundError, ValueError, OSError):
        logger.exception('Model unavailable; run offline training before serving inference')
    yield

app = FastAPI(title='FinRisk AI 2.0 — Research Inference', version='1.0.0', lifespan=lifespan)


@app.middleware('http')
async def service_auth(request: Request, call_next):
    # Production operators must set this key on both backend and ML service.
    expected = os.getenv('ML_SERVICE_KEY')
    if expected and request.url.path not in ['/health']:
        supplied = request.headers.get('x-service-key','')
        if not secrets.compare_digest(expected, supplied):
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=401,content={'error':'Unauthorized service request'})
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


def require_model():
    if not state:
        raise HTTPException(503, 'Model artifact unavailable; an operator must run train.py')


def predict(data: FinancialInput):
    require_model()
    x = feature_vector(data).reshape(1, -1)
    probability = float(state['model'].predict_proba(x)[0, 1])
    explained_x = state['model'][0].transform(x) if isinstance(state['model'], Pipeline) else x
    values = state['explainer'](explained_x)
    contributions = np.asarray(values.values)
    base = np.asarray(values.base_values)
    if contributions.ndim == 3:  # random forest returns one vector per class
        vector = contributions[0, :, 1]
        base_value = float(base[0, 1])
    else:
        vector = contributions[0]
        base_value = float(base.reshape(-1)[0])
    ratios = calculate_ratios(data)
    warnings = []
    if data.creditScore is None:
        warnings.append('Credit score missing: synthetic training reference 650 imputed; use caution.')
    if ratios['disposableIncome'] < 0:
        warnings.append('Expenses and proposed debt service exceed monthly income.')
    if data.existingEmi > 0 and data.existingDebt == 0:
        warnings.append('Existing EMI is positive while declared existing debt is zero; verify inputs.')
    out_of_range = [name for i,name in enumerate(FEATURE_NAMES) if x[0,i] < state['info']['referenceDistributions'][name]['p05'] or x[0,i] > state['info']['referenceDistributions'][name]['p95']]
    if out_of_range:
        warnings.append('Outside central 90% of synthetic training distribution: ' + ', '.join(out_of_range))
    return dict(probability=probability, riskScore=round(probability * 100, 2), riskBand=risk_band(probability),
                modelVersion=state['info']['modelVersion'], synthetic=True,
                probabilityLabel='Illustrative synthetic adverse-outcome probability',
                ratios=ratios,
                contributions=sorted([dict(feature=name, value=float(x[0,i]), contribution=float(vector[i])) for i,name in enumerate(FEATURE_NAMES)],key=lambda row: abs(row['contribution']), reverse=True),
                explanation=dict(method='SHAP', scale=state['scale'], baseValue=base_value,
                                 sumContributions=float(vector.sum()), outputValue=float(base_value+vector.sum()),
                                 note='Contributions explain the trained model output on the stated scale. They are not causal effects.'),
                warnings=warnings, reviewPriority='High' if probability >= .6 or ratios['dti'] > .6 else 'Standard',
                policyVersion='demo-bands-v1', limitations=state['info']['limitations'])


@app.get('/health')
def health():
    return JSONResponse(status_code=200 if state else 503, content=dict(status='ok' if state else 'unavailable', modelLoaded=bool(state), modelVersion=state.get('info',{}).get('modelVersion')))


@app.get('/model/info')
def model_info():
    require_model()
    return state['info']


@app.post('/predict')
def predict_endpoint(data: FinancialInput):
    return predict(data)


@app.post('/explain')
def explain_endpoint(data: FinancialInput):
    return predict(data)


class BatchInput(BaseModel):
    rows: list[dict] = Field(min_length=1, max_length=500)


@app.post('/predict/batch')
def batch_endpoint(data: BatchInput):
    require_model()
    results, errors = [], []
    for index, row in enumerate(data.rows):
        try:
            results.append(predict(FinancialInput.model_validate(row)))
        except ValueError:
            results.append(None)
            errors.append(dict(index=index, message='Invalid financial fields; check numeric ranges and required fields.'))
    return dict(results=results, errors=errors, total=len(data.rows), successCount=len(data.rows)-len(errors))


@app.post('/monitor')
def monitor_endpoint(data: BatchInput):
    require_model()
    validated = []
    invalid = 0
    missing_score = 0
    for row in data.rows:
        try:
            record = FinancialInput.model_validate(row)
            validated.append(feature_vector(record))
            missing_score += int(record.creditScore is None)
        except ValueError:
            invalid += 1
    if not validated:
        raise HTTPException(422, 'No valid financial records to monitor')
    X = np.vstack(validated)
    rows = []
    for i, feature in enumerate(FEATURE_NAMES):
        psi = population_stability_index(X[:, i], state['info']['referenceDistributions'][feature]['histogram'])
        rows.append(dict(feature=feature, psi=psi, indicator='Shift' if psi >= .25 else 'Watch' if psi >= .1 else 'Stable'))
    probabilities = state['model'].predict_proba(X)[:, 1]
    return dict(count=len(validated), invalidRows=invalid, missingCreditScore=missing_score,
                featureDrift=rows, predictionPsi=population_stability_index(probabilities,state['info']['predictionReference']),
                modelVersion=state['info']['modelVersion'],
                note='Descriptive PSI versus synthetic training distribution. 0.1/0.25 are demonstration heuristics, not significance tests. Small samples are unstable. No real outcome accuracy or production drift conclusion is established.',
                warnings=['Fewer than 100 observations; interpret distribution summaries cautiously.'] if len(validated)<100 else [])
