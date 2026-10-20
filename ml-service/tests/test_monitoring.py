import numpy as np
import pytest
from app.monitoring import distribution_reference, population_stability_index


def test_reference_and_shift():
    values=np.arange(1000,dtype=float)
    reference=distribution_reference(values)
    assert sum(reference['proportions'])==pytest.approx(1)
    assert population_stability_index(values,reference)==pytest.approx(0)
    assert population_stability_index(values+1000,reference)>.25


def test_constant_distribution_and_empty_sample():
    reference=distribution_reference(np.ones(100))
    assert population_stability_index(np.ones(25),reference)==pytest.approx(0)
    with pytest.raises(ValueError): population_stability_index([],reference)
