//! Versioned performance-budget classification and evidence contracts.

use std::cmp::Ordering;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Largest raw sample set accepted by the evidence contract.
pub const MAX_PERFORMANCE_SAMPLES: usize = 1_000;
/// Largest comparable history retained for warning evaluation.
pub const MAX_PERFORMANCE_HISTORY: usize = 20;

/// Deterministic performance outcome.
#[derive(Clone, Copy, Debug, Deserialize, Eq, JsonSchema, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PerformanceClassification {
    /// Observation is at or within target.
    Pass,
    /// Observation is beyond target but not beyond the hard limit.
    Warning,
    /// Observation or invariant exceeds a hard limit.
    Failure,
}

/// How a metric reduces multiple observations.
#[derive(Clone, Copy, Debug, Deserialize, Eq, JsonSchema, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PerformanceAggregation {
    P95,
    Maximum,
    Minimum,
    Invariant,
}

/// One catalog metric consumed by the native contract.
#[derive(Clone, Debug, Deserialize, JsonSchema, PartialEq, Serialize)]
pub struct PerformanceMetric {
    pub id: String,
    pub aggregation: PerformanceAggregation,
    pub target: Option<f64>,
    pub hard_limit: Option<f64>,
    pub threshold_kind: Option<String>,
    pub target_multiplier: Option<f64>,
    pub target_constant: Option<f64>,
    pub hard_multiplier: Option<f64>,
    pub hard_constant: Option<f64>,
    pub minimum_samples: usize,
    pub maximum_samples: usize,
    pub failure_invariants: Vec<String>,
}

/// Deterministic summary derived from bounded samples.
#[derive(Clone, Copy, Debug, Deserialize, JsonSchema, PartialEq, Serialize)]
pub struct PerformanceSummary {
    pub median: f64,
    pub p95: f64,
    pub maximum: f64,
}

/// Comparable fields used by the two-warning rule.
#[derive(Clone, Debug, Deserialize, Eq, JsonSchema, PartialEq, Serialize)]
pub struct PerformanceHistoryEntry {
    pub catalog_version: String,
    pub metric_id: String,
    pub scenario_id: String,
    pub scenario_digest: Option<String>,
    pub profile_id: String,
    pub evidence_class: String,
    pub build_profile: String,
    pub cold_state: bool,
    pub method: String,
    pub classification: PerformanceClassification,
}

/// Result of bounded warning-history evaluation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PerformanceHistoryResult {
    pub failure: bool,
    pub follow_up: bool,
    pub warning_streak: usize,
}

/// Validates and summarizes a bounded finite sample set using nearest-rank percentiles.
///
/// # Errors
///
/// Returns a stable error when the bounds or samples are invalid.
pub fn summarize_samples(
    samples: &[f64],
    minimum: usize,
    maximum: usize,
) -> Result<PerformanceSummary, &'static str> {
    if minimum == 0
        || maximum < minimum
        || maximum > MAX_PERFORMANCE_SAMPLES
        || samples.len() < minimum
        || samples.len() > maximum
    {
        return Err("performance_sample_count_invalid");
    }
    if samples
        .iter()
        .any(|sample| !sample.is_finite() || *sample < 0.0)
    {
        return Err("performance_sample_value_invalid");
    }
    let mut sorted = samples.to_vec();
    sorted.sort_by(|left, right| left.partial_cmp(right).unwrap_or(Ordering::Equal));
    Ok(PerformanceSummary {
        median: nearest_rank(&sorted, 50, 100),
        p95: nearest_rank(&sorted, 95, 100),
        maximum: nearest_rank(&sorted, 1, 1),
    })
}

fn nearest_rank(sorted: &[f64], numerator: usize, denominator: usize) -> f64 {
    let rank = sorted
        .len()
        .saturating_mul(numerator)
        .div_ceil(denominator)
        .clamp(1, sorted.len());
    sorted[rank - 1]
}

/// Classifies one metric observation and gives declared invariants precedence.
///
/// # Errors
///
/// Returns a stable error when the observation or threshold inputs are invalid.
pub fn classify(
    metric: &PerformanceMetric,
    value: f64,
    source_bytes: Option<u64>,
    failed_invariants: &[String],
) -> Result<PerformanceClassification, &'static str> {
    if !value.is_finite() || value < 0.0 {
        return Err("performance_observation_invalid");
    }
    if metric
        .failure_invariants
        .iter()
        .any(|name| failed_invariants.contains(name))
    {
        return Ok(PerformanceClassification::Failure);
    }
    let (target, hard_limit) = thresholds(metric, source_bytes)?;
    if value <= target {
        Ok(PerformanceClassification::Pass)
    } else if value <= hard_limit {
        Ok(PerformanceClassification::Warning)
    } else {
        Ok(PerformanceClassification::Failure)
    }
}

fn thresholds(
    metric: &PerformanceMetric,
    source_bytes: Option<u64>,
) -> Result<(f64, f64), &'static str> {
    let values = if metric.threshold_kind.as_deref() == Some("source_relative") {
        let source = f64::from(
            u32::try_from(source_bytes.ok_or("performance_source_bytes_required")?)
                .map_err(|_| "performance_source_bytes_invalid")?,
        );
        (
            source
                * metric
                    .target_multiplier
                    .ok_or("performance_threshold_invalid")?
                + metric
                    .target_constant
                    .ok_or("performance_threshold_invalid")?,
            source
                * metric
                    .hard_multiplier
                    .ok_or("performance_threshold_invalid")?
                + metric
                    .hard_constant
                    .ok_or("performance_threshold_invalid")?,
        )
    } else {
        (
            metric.target.ok_or("performance_threshold_invalid")?,
            metric.hard_limit.ok_or("performance_threshold_invalid")?,
        )
    };
    if !values.0.is_finite() || !values.1.is_finite() || values.0 < 0.0 || values.1 < values.0 {
        return Err("performance_threshold_invalid");
    }
    Ok(values)
}

/// Applies the hard-failure and consecutive-comparable-warning policy to bounded history.
pub fn evaluate_history(entries: &[PerformanceHistoryEntry]) -> PerformanceHistoryResult {
    let mut previous: Option<&PerformanceHistoryEntry> = None;
    let mut streak = 0;
    for entry in entries
        .iter()
        .rev()
        .take(MAX_PERFORMANCE_HISTORY)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
    {
        match entry.classification {
            PerformanceClassification::Failure => {
                return PerformanceHistoryResult {
                    failure: true,
                    follow_up: false,
                    warning_streak: streak,
                };
            }
            PerformanceClassification::Pass => {
                previous = Some(entry);
                streak = 0;
            }
            PerformanceClassification::Warning => {
                streak = if previous.is_some_and(|prior| {
                    comparable(prior, entry)
                        && prior.classification == PerformanceClassification::Warning
                }) {
                    streak + 1
                } else {
                    1
                };
                if streak >= 2 {
                    return PerformanceHistoryResult {
                        failure: false,
                        follow_up: true,
                        warning_streak: streak,
                    };
                }
                previous = Some(entry);
            }
        }
    }
    PerformanceHistoryResult {
        failure: false,
        follow_up: false,
        warning_streak: streak,
    }
}

fn comparable(left: &PerformanceHistoryEntry, right: &PerformanceHistoryEntry) -> bool {
    left.catalog_version == right.catalog_version
        && left.metric_id == right.metric_id
        && left.scenario_id == right.scenario_id
        && left.scenario_digest == right.scenario_digest
        && left.profile_id == right.profile_id
        && left.evidence_class == right.evidence_class
        && left.build_profile == right.build_profile
        && left.cold_state == right.cold_state
        && left.method == right.method
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metric() -> PerformanceMetric {
        PerformanceMetric {
            id: "editor_input_paint".into(),
            aggregation: PerformanceAggregation::P95,
            target: Some(50.0),
            hard_limit: Some(100.0),
            threshold_kind: None,
            target_multiplier: None,
            target_constant: None,
            hard_multiplier: None,
            hard_constant: None,
            minimum_samples: 1,
            maximum_samples: 100,
            failure_invariants: vec!["repeated_hard_stall".into()],
        }
    }

    #[test]
    fn summaries_and_classification_use_exact_boundaries() {
        assert_eq!(
            summarize_samples(&[5.0, 1.0, 4.0, 2.0, 3.0], 5, 5).unwrap(),
            PerformanceSummary {
                median: 3.0,
                p95: 5.0,
                maximum: 5.0
            }
        );
        assert_eq!(
            classify(&metric(), 50.0, None, &[]).unwrap(),
            PerformanceClassification::Pass
        );
        assert_eq!(
            classify(&metric(), 50.1, None, &[]).unwrap(),
            PerformanceClassification::Warning
        );
        assert_eq!(
            classify(&metric(), 100.1, None, &[]).unwrap(),
            PerformanceClassification::Failure
        );
        assert_eq!(
            classify(&metric(), 1.0, None, &["repeated_hard_stall".into()]).unwrap(),
            PerformanceClassification::Failure
        );
    }

    #[test]
    fn relative_threshold_requires_source_size() {
        let relative = PerformanceMetric {
            threshold_kind: Some("source_relative".into()),
            target: None,
            hard_limit: None,
            target_multiplier: Some(2.5),
            target_constant: Some(10.0),
            hard_multiplier: Some(4.0),
            hard_constant: Some(20.0),
            ..metric()
        };
        assert_eq!(
            classify(&relative, 260.0, Some(100), &[]).unwrap(),
            PerformanceClassification::Pass
        );
        assert_eq!(
            classify(&relative, 261.0, Some(100), &[]).unwrap(),
            PerformanceClassification::Warning
        );
        assert_eq!(
            classify(&relative, 421.0, Some(100), &[]).unwrap(),
            PerformanceClassification::Failure
        );
        assert_eq!(
            classify(&relative, 1.0, None, &[]),
            Err("performance_source_bytes_required")
        );
    }

    fn entry(classification: PerformanceClassification, method: &str) -> PerformanceHistoryEntry {
        PerformanceHistoryEntry {
            catalog_version: "1".into(),
            metric_id: "m".into(),
            scenario_id: "s".into(),
            scenario_digest: None,
            profile_id: "p".into(),
            evidence_class: "reference".into(),
            build_profile: "release".into(),
            cold_state: false,
            method: method.into(),
            classification,
        }
    }

    #[test]
    fn history_requires_adjacent_comparable_warnings() {
        assert!(
            evaluate_history(&[
                entry(PerformanceClassification::Warning, "v1"),
                entry(PerformanceClassification::Warning, "v1")
            ])
            .follow_up
        );
        assert!(
            !evaluate_history(&[
                entry(PerformanceClassification::Warning, "v1"),
                entry(PerformanceClassification::Warning, "v2")
            ])
            .follow_up
        );
        assert!(
            evaluate_history(&[
                entry(PerformanceClassification::Pass, "v1"),
                entry(PerformanceClassification::Failure, "v1")
            ])
            .failure
        );
    }
}
