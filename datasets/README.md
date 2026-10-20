# Dataset provenance

`synthetic-credit-v1.csv` is generated entirely locally by `ml-service/train.py`, seed 2026. It contains 2,400 artificial financial profiles in INR and a Bernoulli-generated `illustrativeAdverseOutcome` label. There are no real identities or personal records. The generated dataset is dedicated under CC0 1.0; the generator source remains governed by the project's source-code license.

The synthetic label is sampled from a logistic data-generating function using financial ratios, debt, bureau-score-like values, employment duration and interest assumptions. It is **not observed loan default**, and test-set metrics indicate recovery of this artificial process only. They are not evidence of suitability for actual borrowers. The label and synthetic ID are excluded from training features.

The generation has no missing values. Production inference with a missing credit score uses the documented synthetic reference 650 and emits a warning. No credit bureau integration is present. Scores are explicitly on a demonstration 300–900 range.

## Public data research

UCI Statlog (German Credit Data) is a possible future benchmark (UCI dataset 144, DOI 10.24432/C5NC77). Its population, historical context, target and features do not match these synthetic INR profiles. An attempt to read the official UCI metadata endpoint `https://archive.ics.uci.edu/api/dataset?id=144` in this environment returned proxy HTTP 403. Consequently its current license and provenance were **not independently verified here** and no UCI data has been downloaded, redistributed or used. Before adding any external dataset, verify the exact upstream license, authoritative provenance, data dictionary, target and population limitations; preserve that evidence and use a separate versioned pipeline. Do not silently substitute a dataset or claim synthetic evaluation generalizes to it.

## Leakage and split

The dataset uses stratified disjoint 60/20/20 training/validation/test splits. Preprocessing is fitted inside a training pipeline. Three-fold cross-validation uses only the training partition. Candidate selection uses validation Brier score; held-out test rows are used only for final evaluation. No applicant identifiers, label, or underlying generating probability are features. Synthetic generation still imposes a strong structural prior and cannot establish external validity.
