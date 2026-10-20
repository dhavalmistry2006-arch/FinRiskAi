"""Versioned financial calculations; no protected characteristics are model inputs."""
from pydantic import BaseModel, ConfigDict, Field, model_validator
import math
import numpy as np

FEATURE_VERSION = 'financial-v1'
FEATURE_NAMES = ['dti', 'emiToIncome', 'expenseToIncome', 'loanToIncome', 'debtToAnnualIncome', 'creditScoreNormalized', 'employmentYears', 'tenureYears', 'interestRate']

class FinancialInput(BaseModel):
    model_config = ConfigDict(extra='ignore', allow_inf_nan=False)
    monthlyIncome: float = Field(gt=0, le=100_000_000)
    monthlyExpenses: float = Field(ge=0, le=100_000_000)
    existingDebt: float = Field(default=0, ge=0, le=1_000_000_000)
    existingEmi: float = Field(default=0, ge=0, le=100_000_000)
    creditScore: float | None = Field(default=None, ge=300, le=900)
    loanAmount: float = Field(gt=0, le=1_000_000_000)
    tenureMonths: int = Field(ge=1, le=600)
    interestRate: float = Field(default=12, ge=0, le=60)
    employmentMonths: int = Field(default=24, ge=0, le=720)
    employmentType: str = Field(default='Salaried', max_length=60)
    loanPurpose: str = Field(default='Personal', max_length=100)


def calculate_ratios(data: FinancialInput) -> dict:
    """DTI includes existing and proposed monthly debt service, not expenses."""
    principal, months = data.loanAmount, data.tenureMonths
    rate = data.interestRate / 1200
    # expm1/log1p preserves precision near zero interest.
    emi = principal / months if rate == 0 else principal * rate / (-math.expm1(-months * math.log1p(rate)))
    total = emi * months
    return {
        'emi': emi,
        'dti': (data.existingEmi + emi) / data.monthlyIncome,
        'emiToIncome': emi / data.monthlyIncome,
        'expenseToIncome': data.monthlyExpenses / data.monthlyIncome,
        'disposableIncome': data.monthlyIncome - data.monthlyExpenses - data.existingEmi - emi,
        'loanToIncome': principal / (data.monthlyIncome * 12),
        'totalRepayment': total,
        'totalInterest': max(0.0, total - principal),
    }


def feature_vector(data: FinancialInput) -> np.ndarray:
    ratios = calculate_ratios(data)
    return np.array([
        ratios['dti'], ratios['emiToIncome'], ratios['expenseToIncome'],
        ratios['loanToIncome'], data.existingDebt / (data.monthlyIncome * 12),
        ((data.creditScore if data.creditScore is not None else 650) - 300) / 600,
        data.employmentMonths / 12, data.tenureMonths / 12, data.interestRate,
    ], dtype=np.float64)


def risk_band(probability: float) -> str:
    return 'Low' if probability < .15 else 'Moderate' if probability < .35 else 'Elevated' if probability < .6 else 'High'
