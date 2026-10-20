import math
import numpy as np
from fastapi.testclient import TestClient
from app.main import app, state
from train import generate

SAMPLE = dict(monthlyIncome=80000, monthlyExpenses=30000, existingDebt=200000, existingEmi=5000,
              creditScore=740, loanAmount=500000, tenureMonths=48, interestRate=12, employmentMonths=60)


def test_generated_dataset_reproducible():
    assert generate(count=10).equals(generate(count=10))
    assert not generate(seed=2027,count=10).equals(generate(count=10))


def test_model_and_prediction_explanation_additivity():
    with TestClient(app) as client:
        assert client.get('/health').json()['modelLoaded']
        info=client.get('/model/info').json()
        assert len(info['comparison']) == 3
        assert info['split']==dict(train=1440,validation=480,test=480,method='Stratified 60/20/20, seed 2026; no test-set model selection')
        assert 0<= info['metrics']['rocAuc']<=1
        response=client.post('/predict',json=SAMPLE)
        assert response.status_code==200
        result=response.json()
        assert result['synthetic'] is True
        assert 0<=result['probability']<=1
        exp=result['explanation']
        reconstructed=exp['baseValue']+sum(item['contribution'] for item in result['contributions'])
        if exp['scale']=='log-odds': reconstructed=1/(1+math.exp(-reconstructed))
        assert abs(reconstructed-result['probability'])<1e-6
        assert client.post('/predict',json=SAMPLE).json()==result
        assert client.post('/explain',json=SAMPLE).json()['modelVersion']==result['modelVersion']


def test_batch_partial_failure_and_validation():
    with TestClient(app) as client:
        result=client.post('/predict/batch',json={'rows':[SAMPLE,{'monthlyIncome':0}]}).json()
        assert result['successCount']==1
        assert result['results'][1] is None
        assert result['errors'][0]['index']==1
        assert client.post('/predict',json={**SAMPLE,'creditScore':1000}).status_code==422
        assert client.post('/predict/batch',json={'rows':[]}).status_code==422


def test_missing_credit_warning():
    with TestClient(app) as client:
        result=client.post('/predict',json={**SAMPLE,'creditScore':None}).json()
        assert any('imputed' in w for w in result['warnings'])


def test_service_auth(monkeypatch):
    monkeypatch.setenv('ML_SERVICE_KEY','test-local-key')
    with TestClient(app) as client:
        assert client.get('/health').status_code==200
        assert client.post('/predict',json=SAMPLE).status_code==401
        assert client.post('/predict',json=SAMPLE,headers={'x-service-key':'test-local-key'}).status_code==200


def test_unavailable_model_no_fake_fallback():
    with TestClient(app) as client:
        saved=state.copy(); state.clear()
        try:
            assert client.post('/predict',json=SAMPLE).status_code==503
            assert client.get('/health').status_code == 503
            assert client.get('/health').json()['modelLoaded'] is False
        finally:
            state.update(saved)


def test_monitoring_reports_real_distributions():
    with TestClient(app) as client:
        result=client.post('/monitor',json={'rows':[SAMPLE]*25+[{'monthlyIncome':0}]}).json()
        assert result['count']==25
        assert result['invalidRows']==1
        assert len(result['featureDrift'])==9
        assert result['predictionPsi']>=0
        assert result['warnings']
        assert client.post('/monitor',json={'rows':[{}]}).status_code==422


def test_model_probability_extremes_and_artifact_registry():
    from app.main import ROOT
    import hashlib
    with TestClient(app) as client:
        info=client.get('/model/info').json()
        assert info['artifactSha256']==hashlib.sha256((ROOT/'artifacts/model.joblib').read_bytes()).hexdigest()
        for profile in [dict(monthlyIncome=1,monthlyExpenses=0,loanAmount=1e9,tenureMonths=1,interestRate=60),dict(monthlyIncome=1e8,monthlyExpenses=0,loanAmount=1,tenureMonths=600,interestRate=0,creditScore=900)]:
            result=client.post('/predict',json=profile)
            assert result.status_code==200
            assert 0<=result.json()['probability']<=1
