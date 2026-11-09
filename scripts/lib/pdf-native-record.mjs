/** Translate observed staged native proof; no platform or unmeasured heap claim is synthesized. */
export function nativePdfConformanceRecord(result, profile) {
  if (
    result.status !== 'pass' ||
    result.execution?.completion !== 'clean' ||
    result.evidence_class !== 'staged_release_native_webview' ||
    result.debug_assertions !== false ||
    result.runtime?.debuggable !== result.debug_assertions
  )
    throw Error('Completed actual staged native proof required');
  const journey = result.journey,
    measurements = journey.measurements;
  const timing = (metric) => ({
    method: 'performance_now_action_to_observed_outcome_25ms_poll',
    samples_ms: measurements.samples
      .filter((row) => row.metric === metric)
      .map((row) => row.milliseconds),
  });
  const phases = journey.resource_phases.filter(Boolean);
  const maximum = (fn) => Math.max(...phases.map(fn));
  return {
    schema_version: 1,
    case_id: 'native_pdf_reading_print',
    profile,
    attempt: 1,
    status: 'pass',
    source_commit: result.source_commit,
    fixture_sha256: result.source_sha256,
    artifact_sha256: result.package.package_sha256,
    installed_sha256: result.package.executable_sha256,
    manifest_sha256: result.package.manifest_sha256,
    runtime: result.runtime,
    execution: result.execution,
    checks: {
      worker: journey.worker === 'true',
      selectable_text: journey.checks.embedded_font_text === true,
      reading:
        [
          'outline_named_destination',
          'search',
          'thumbnail',
          'internal_link',
          'external_link_disclosure',
          'rotation',
          'go_to_page',
          'keyboard',
          'metadata',
        ].every((k) => journey.checks[k] === true) &&
        journey.warm_delivery === true,
      native_print:
        journey.prints.length === 2 &&
        journey.prints.every(
          (p) => p.completed && p.cleaned && p.snapshot.decoded,
        ),
      source_unchanged: result.source_unchanged === true,
      cache_disposal:
        journey.disposal.worker_terminated === true &&
        journey.disposal.workers === 0 &&
        journey.disposal.surfaces === 0 &&
        journey.disposal.surfaceBytes === 0,
    },
    measurements: {
      first_page: result.native_first_page,
      navigation: timing('navigation'),
      search: timing('search_complete'),
      thumbnail: timing('first_thumbnail'),
      disposal: {
        method: 'actual_worker_terminated_event',
        samples_ms: [journey.disposal.elapsed_ms],
      },
      interaction: measurements.interaction,
      long_tasks: measurements.long_tasks,
      memory: result.process_memory,
      resources: {
        peak_surface_bytes: maximum((p) => p.peakSurfaceBytes),
        surface_limit_bytes: 200 * 1024 * 1024,
        max_range_bytes: maximum((p) => p.range.maximumRequestBytes),
        range_limit_bytes: 262144,
        peak_range_concurrency: maximum((p) => p.range.peakConcurrency),
        range_concurrency_limit: 2,
        cache_before_bytes: 0,
        cache_after_bytes: 0,
        cache_method: 'seekable_native_file_no_private_stream_cache',
        scope:
          'Controller source reads and owned surfaces; desktop seekable source does not allocate Android private stream cache',
      },
      worker_heap: {
        status: 'not_measured',
        reason:
          'Named application process RSS does not isolate separate WebView or parser worker heaps',
      },
    },
  };
}

export function androidPdfConformanceRecord(row, binding) {
  const pdf = row.observations,
    identity = row.identity;
  if (
    row.case_id !== 'pdf' ||
    row.status !== 'pass' ||
    binding.campaignComplete !== true ||
    binding.minified !== true
  )
    throw Error('Full minified Android PDF campaign required');
  const phases = pdf.resource_phases;
  const maximum = (fn) => Math.max(...phases.map(fn));
  const reading = pdf.measurements.reading;
  const timing = (metric) => ({
    method: 'performance_now_action_to_observed_outcome_25ms_poll',
    samples_ms: reading.samples
      .filter((r) => r.metric === metric)
      .map((r) => r.milliseconds),
  });
  return {
    schema_version: 1,
    case_id: 'native_pdf_reading_print',
    profile: 'android_api' + identity.api_level,
    attempt: 1,
    status: 'pass',
    source_commit: identity.source_commit,
    fixture_sha256: pdf.fixture_sha256,
    artifact_sha256: binding.artifactSha,
    installed_sha256: identity.application_sha256,
    manifest_sha256: binding.manifestSha,
    execution: binding.execution,
    runtime: {
      os: 'Android/API' + identity.api_level,
      architecture: identity.architecture,
      webview: identity.webview_package + '/' + identity.webview_version,
      engine: pdf.facts.engine,
      api: identity.api_level,
      minified: binding.minified,
      debuggable: identity.application_debuggable,
    },
    checks: {
      worker: pdf.facts.worker === 'true',
      selectable_text: pdf.facts.selected.includes(
        'Glitchpad PDF compatibility page 1',
      ),
      reading: Object.values(pdf.reading_journey.checks).every(
        (v) => v === true || Number.isFinite(v),
      ),
      native_print: ['selected', 'all'].every(
        (k) =>
          pdf.print[k].output_ink.every((n) => n > 500) &&
          pdf.print[k].private_spool_cleaned,
      ),
      source_unchanged: pdf.source_unchanged,
      cache_disposal:
        pdf.stream_cache_removed &&
        pdf.disposal.worker_terminated &&
        pdf.disposal.workers === 0 &&
        pdf.disposal.surfaces === 0 &&
        pdf.disposal.surfaceBytes === 0,
    },
    measurements: {
      first_page: pdf.measurements.first_page,
      navigation: timing('navigation'),
      search: timing('search_complete'),
      thumbnail: timing('first_thumbnail'),
      disposal: {
        method: 'actual_worker_terminated_event',
        samples_ms: [pdf.disposal.elapsed_ms],
      },
      interaction: reading.interaction,
      long_tasks: reading.long_tasks,
      memory: pdf.measurements.memory,
      resources: {
        peak_surface_bytes: maximum((p) => p.peakSurfaceBytes),
        surface_limit_bytes: 96 * 1024 * 1024,
        max_range_bytes: maximum((p) => p.range.maximumRequestBytes),
        range_limit_bytes: 262144,
        peak_range_concurrency: maximum((p) => p.range.peakConcurrency),
        range_concurrency_limit: 2,
        cache_before_bytes: pdf.stream_cache_files.reduce((a, b) => a + b, 0),
        cache_after_bytes: pdf.stream_cache_removed ? 0 : null,
        cache_method: 'actual_private_stream_files_populated_then_removed',
        scope:
          'Controller reads and owned surfaces, plus actual private stream-cache file lengths',
      },
      worker_heap: {
        status: 'not_measured',
        reason:
          'Application process PSS does not isolate parser worker or separate WebView heap',
      },
    },
  };
}
