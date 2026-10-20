import math
import numpy as np
import pytest
from pydantic import ValidationError
from app.features import FinancialInput, calculate_ratios, feature_vector, risk_band


def sample(**changes):
    values = dict(monthlyIncome=100000, monthlyExpenses=30000, existingDebt=100000, existingEmi=5000,
                  creditScore=750, loanAmount=100000, tenureMonths=12, interestRate=12, employmentMonths=36)
    values.update(changes)
    return FinancialInput(**values)


def test_emi_known_amortization():
    r = calculate_ratios(sample())
    assert r['emi'] == pytest.approx(8884.878867834, rel=1e-9)
    assert r['totalRepayment'] == pytest.approx(r['emi']*12)
    assert r['totalInterest'] == pytest.approx(r['totalRepayment']-100000)
    assert r['dti'] == pytest.approx((5000+r['emi'])/100000)
    assert r['disposableIncome'] == pytest.approx(65000-r['emi'])


def test_zero_interest():
    r = calculate_ratios(sample(interestRate=0))
    assert r['emi'] == pytest.approx(100000/12)
    assert r['totalInterest'] == 0


def test_tiny_interest_numerically_stable():
    assert calculate_ratios(sample(interestRate=1e-12))['emi'] == pytest.approx(100000/12,rel=1e-9)


@pytest.mark.parametrize('changes',[dict(monthlyIncome=0), dict(loanAmount=-10), dict(tenureMonths=0), dict(tenureMonths=12.5), dict(interestRate=-1), dict(creditScore=901), dict(monthlyIncome=float('nan')),dict(monthlyExpenses=float('inf'))])
def test_invalid_input_rejected(changes):
    with pytest.raises(ValidationError): sample(**changes)


def test_missing_credit_imputation_explicit_and_protected_fields_unused():
    assert feature_vector(sample(creditScore=None))[5] == pytest.approx((650-300)/600)
    assert len(feature_vector(sample())) == 9


@pytest.mark.parametrize('p,band',[(0,'Low'),(.1499,'Low'),(.15,'Moderate'),(.35,'Elevated'),(.6,'High'),(1,'High')])
def test_versioned_thresholds(p,band):
    assert risk_band(p)==band
