//! Content-free process memory sampling for reference performance evidence.

use std::fmt;

/// Maximum observations retained by one native memory run.
pub const MAX_MEMORY_SAMPLES: usize = 60;

/// Content-free native resource totals used by lifecycle conformance tests.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct NativeLeaseSnapshot {
    /// Open native sources.
    pub sources: usize,
    /// Active bounded source streams.
    pub streams: usize,
    /// Active integrity calculations and their derived leases.
    pub integrity_operations: usize,
}

/// Stable failures emitted by the native sampler without machine-specific details.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PerformanceSampleError {
    /// The requested sample count was outside the bounded contract.
    InvalidSampleCount,
    /// The current platform could not provide a trustworthy working-set value.
    WorkingSetUnavailable,
}

impl fmt::Display for PerformanceSampleError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidSampleCount => "performance_sample_count_invalid",
            Self::WorkingSetUnavailable => "performance_working_set_unavailable",
        })
    }
}

impl std::error::Error for PerformanceSampleError {}

/// Collects a bounded series while keeping scheduling policy in the platform harness.
///
/// # Errors
///
/// Returns a stable error for an invalid count or a sampler failure.
pub fn sample_working_set_with(
    sample_count: usize,
    mut sample: impl FnMut() -> Result<u64, PerformanceSampleError>,
) -> Result<Vec<u64>, PerformanceSampleError> {
    if !(1..=MAX_MEMORY_SAMPLES).contains(&sample_count) {
        return Err(PerformanceSampleError::InvalidSampleCount);
    }
    (0..sample_count).map(|_| sample()).collect()
}

/// Returns the current process resident working set in bytes through a safe,
/// cross-platform process API.
///
/// # Errors
///
/// Returns a stable unavailable error when the platform process API cannot sample.
pub fn current_working_set_bytes() -> Result<u64, PerformanceSampleError> {
    use sysinfo::get_current_pid;

    let pid = get_current_pid().map_err(|_| PerformanceSampleError::WorkingSetUnavailable)?;
    working_set_bytes_for_pid(pid.as_u32())
}

/// Returns the resident working set for a specific process identifier.
///
/// # Errors
///
/// Returns a stable unavailable error when the process is absent or cannot be sampled.
pub fn working_set_bytes_for_pid(pid: u32) -> Result<u64, PerformanceSampleError> {
    use sysinfo::{Pid, ProcessesToUpdate, System};

    if pid == 0 {
        return Err(PerformanceSampleError::WorkingSetUnavailable);
    }
    let pid = Pid::from_u32(pid);
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
    system
        .process(pid)
        .map(sysinfo::Process::memory)
        .filter(|bytes| *bytes > 0)
        .ok_or(PerformanceSampleError::WorkingSetUnavailable)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_sampler_preserves_order_and_rejects_invalid_counts() {
        let mut next = 0_u64;
        let samples = sample_working_set_with(3, || {
            next += 1;
            Ok(next)
        })
        .unwrap();
        assert_eq!(samples, [1, 2, 3]);
        assert_eq!(
            sample_working_set_with(0, || Ok(1)),
            Err(PerformanceSampleError::InvalidSampleCount)
        );
        assert_eq!(
            sample_working_set_with(MAX_MEMORY_SAMPLES + 1, || Ok(1)),
            Err(PerformanceSampleError::InvalidSampleCount)
        );
    }

    #[test]
    fn current_process_sample_is_nonzero_when_supported() {
        if let Ok(bytes) = current_working_set_bytes() {
            assert!(bytes > 0);
        }
    }

    #[test]
    fn zero_process_identifier_is_rejected() {
        assert_eq!(
            working_set_bytes_for_pid(0),
            Err(PerformanceSampleError::WorkingSetUnavailable)
        );
    }
}
