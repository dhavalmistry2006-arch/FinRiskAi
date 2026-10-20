# Model card — synthetic-credit-v1.0.0

**Intended use:** educational financial risk research and a synthetic portfolio demonstration. **Prohibited interpretation:** validated real-borrower probability of default, credit eligibility, regulatory approval, an automated lending decision, or credit-bureau scoring.

## Training data and target

2,400 locally generated artificial financial records, seed 2026, version `synthetic-credit-v1`. `illustrativeAdverseOutcome` is a Bernoulli outcome from a documented logistic generator. It has no observed-default horizon or observed real performance. Generated data is CC0 1.0. See `datasets/README.md` for external-data research and why no external credit dataset is claimed as verified or used.

## Algorithm and evaluation

The pipeline compares Logistic Regression, Random Forest and Histogram Gradient Boosting. It selects the actual final candidate by validation Brier score, not a preferred label. `ml-service/artifacts/metadata.json` is the authoritative measured model card supplement: it contains actual selected algorithm, timestamp, dataset hash, hyperparameters, training-only three-fold CV, untouched test metrics, calibration and ROC/PR curves. Do not copy metrics into marketing claims without this synthetic context.

Calibration is **assessed** on held-out synthetic rows. No real-world calibration is established. Reported probabilities concern the synthetic target only. No confidence interval is claimed. Local explanations use SHAP and declare contribution scale; global importance uses held-out permutation importance. Neither establishes causality.

## Threshold policy

`demo-bands-v1`: Low <0.15, Moderate 0.15–<0.35, Elevated 0.35–<0.60, High ≥0.60. These configurable-in-code, versioned demonstration bands indicate analyst review priority. They are not regulatory thresholds and do not approve or reject a borrower. Workflow reviewer decisions require a human and recorded reason.

## Population, fairness and limitations

Synthetic INR financial ranges are chosen for illustration, not representative sampling of India or any borrower population. Credit-score-like values use a 300–900 scale; no official bureau feed is integrated. Missing credit scores use a warned synthetic reference of 650. No protected demographic attribute is modeled, but financial and employment features may still proxy protected traits. Held-out employment-duration subgroup metrics describe artificial data only. No demographic fairness certification or real default monitoring is claimed. A representative consented evaluation set, lawful subgroup definitions, robustness research, independent calibration, privacy review and domain validation are prerequisites before any real-world application.

Loan purpose and employment type currently do not influence the model; they support portfolio segmentation only. The default risk score is probability ×100, not a credit-bureau score. Portfolio expected-loss calculations are illustrative when fed these synthetic probabilities and an assumed LGD/EAD.

## Operations

Training is offline and operator initiated. Model version and policy version accompany every prediction. A service restart loads trusted local artifacts. The API fails closed with 503 if no artifact can be loaded; no heuristic prediction is used as a fallback. Production deployment requires a private service network and service authentication, CPU limits, approved model artifacts and a documented retention policy. Source changes/retraining must increment the model version and undergo tests and operator review; changing a model file in place is not a registry promotion workflow.
