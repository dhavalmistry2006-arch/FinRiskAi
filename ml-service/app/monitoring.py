"""Descriptive distribution monitoring, not real-world accuracy measurement."""
import numpy as np


def distribution_reference(values, bins=10):
    values = np.asarray(values, dtype=float)
    cuts = np.unique(np.quantile(values, np.linspace(0, 1, bins+1)[1:-1]))
    counts, _ = np.histogram(values, bins=np.r_[-np.inf, cuts, np.inf])
    return dict(cuts=cuts.tolist(), proportions=(counts / len(values)).tolist(), count=len(values))


def population_stability_index(values, reference):
    values = np.asarray(values, dtype=float)
    if not len(values):
        raise ValueError('Monitoring requires observations')
    counts, _ = np.histogram(values, bins=np.r_[-np.inf, reference['cuts'], np.inf])
    observed = counts / len(values)
    expected = np.asarray(reference['proportions'], dtype=float)
    # Smooth empty buckets to keep PSI finite. Interpretation depends on sample size.
    observed = np.maximum(observed, 1e-6)
    expected = np.maximum(expected, 1e-6)
    return float(np.sum((observed-expected)*np.log(observed/expected)))
