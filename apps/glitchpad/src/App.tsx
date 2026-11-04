import { createDesktopSaveOperationId } from './domain/desktop-delivery-gateway';
import { externalRevisionMatches } from './domain/contracts';
import { installRecoveryProbeListener } from './domain/recovery-probes';
import {
  saveFailureReason,
  saveFailureMessage,
} from './domain/android-authoring-gateway';
import { recordFailure } from './domain/diagnostic-failures';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { AppFrame } from '../../../brand/web/react/server';
import { AppFrameEnvironmentBridge } from '../../../brand/web/react/environment';

import { AddDocumentMenu } from './components/AddDocumentMenu';
import { createDraftSession } from './domain/drafts';
import {
  nativeAndroidAuthoringGateway,
  type AndroidAuthoringGateway,
} from './domain/android-authoring-gateway';
import { ApplicationMenu } from './components/ApplicationMenu';
import { DocumentSurface } from './components/DocumentSurface';
import { MetadataInspector } from './components/MetadataInspector';
import { PreferencesPanel } from './components/PreferencesPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import type { TextEditorHandle } from './components/TextEditorSurface';
import {
  RecoveryCandidateResolution,
  RecoveryResolution,
  type RecoveryCandidateDecision,
} from './components/RecoveryResolution';
import { TabStrip } from './components/TabStrip';
import {
  performCommand,
  commandSetFor,
  type CommandDescriptor,
} from './domain/commands';
import { type ShellSession } from './domain/contracts';
import {
  canSaveInPlace,
  integrityOf,
  projectRecoveredSession,
} from './domain/recovery';
import {
  nativeRecoveryAvailable,
  nativeRecoveryGateway,
  type RecoveryGateway,
} from './domain/recovery-gateway';
import { createTabState, tabReducer } from './domain/tabs';
import {
  nativeExternalLinkAvailable,
  nativeMarkdownExternalLinkGateway,
  type MarkdownExternalLinkGateway,
  type MarkdownLocalAssetGateway,
} from './domain/markdown-gateway';
import { useRecovery } from './domain/use-recovery';
import {
  browserClipboardGateway,
  createIntegrityRequestId,
  createNativeMetadataGateway,
  nativeMetadataAvailable,
  runIntegrityRequest,
  type ClipboardGateway,
  type MetadataGateway,
} from './domain/metadata-gateway';
import {
  projectSessionMetadata,
  type MetadataContribution,
} from './domain/metadata';
import { PreferenceContext } from './domain/preference-context';
import {
  normalizeExtension,
  type SessionProjection,
  type SessionState,
} from './domain/persistence';
import {
  browserDiagnosticExportGateway,
  nativeAndroidDiagnosticExportGateway,
  nativePersistenceAvailable,
  nativePersistenceGateway,
  type DiagnosticExportGateway,
  type PersistenceGateway,
} from './domain/persistence-gateway';
import { usePersistence } from './domain/use-persistence';
import {
  nativeAndroidRestorationAvailable,
  nativeAndroidRestorationGateway,
  type AndroidRestorationGateway,
} from './domain/android-restoration-gateway';
import {
  nativeAndroidDeliveryAvailable,
  nativeAndroidDeliveryGateway,
  type AndroidDeliveryGateway,
} from './domain/android-delivery-gateway';
import {
  consumeDesktopMarkdownFailureProbe,
  nativeDesktopDeliveryAvailable,
  nativeDesktopDeliveryGateway,
  reportDesktopDeviceScaleProbe,
  reportDesktopLifecycleProbe,
  type DesktopDeliveryGateway,
  type DesktopDeliveryResult,
} from './domain/desktop-delivery-gateway';

import {
  runPackageWorkflowProbe,
  reportPackageWorkflowFailure,
} from './domain/package-workflow-probe';

interface AppProps {
  sessions?: ShellSession[];
  recoveryGateway?: RecoveryGateway | null;
  externalLinkGateway?: MarkdownExternalLinkGateway;
  localAssetGateway?: MarkdownLocalAssetGateway;
  metadataGateway?: MetadataGateway | null;
  clipboardGateway?: ClipboardGateway;
  persistenceGateway?: PersistenceGateway | null;
  diagnosticExportGateway?: DiagnosticExportGateway;
  androidDeliveryGateway?: AndroidDeliveryGateway | null;
  androidAuthoringGateway?: AndroidAuthoringGateway;
  androidRestorationGateway?: AndroidRestorationGateway | null;
  desktopDeliveryGateway?: DesktopDeliveryGateway | null;
  layoutResizeCanBeIme?: boolean;
}

export function App({
  sessions = [],
  recoveryGateway,
  externalLinkGateway,
  localAssetGateway,
  metadataGateway,
  clipboardGateway = browserClipboardGateway,
  persistenceGateway,
  diagnosticExportGateway,
  androidDeliveryGateway,
  androidAuthoringGateway = nativeAndroidAuthoringGateway,
  androidRestorationGateway,
  desktopDeliveryGateway,
  layoutResizeCanBeIme = nativeAndroidDeliveryAvailable(),
}: AppProps) {
  const [state, dispatch] = useReducer(tabReducer, sessions, createTabState);
  const [commandStatus, setCommandStatus] = useState('');
  const [addDocumentOpen, setAddDocumentOpen] = useState(false);
  const [recoveryProbeGeneration, setRecoveryProbeGeneration] = useState(0);
  useEffect(
    () =>
      installRecoveryProbeListener((stage) => {
        if (stage !== 'root') setRecoveryProbeGeneration((value) => value + 1);
      }),
    [],
  );
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingActions = useRef(new Set<string>());
  const [deliveryError, setDeliveryError] = useState('');
  const [markdownFailureProbe, setMarkdownFailureProbe] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [applicationPanel, setApplicationPanel] = useState<
    'closed' | 'preferences' | 'diagnostics'
  >('closed');
  const [metadataReadySessionId, setMetadataReadySessionId] = useState<
    string | null
  >(null);
  const editorRef = useRef<TextEditorHandle>(null);
  const metadataOpenerRef = useRef<HTMLElement | null>(null);
  const applicationOpenerRef = useRef<HTMLButtonElement | null>(null);
  const integrityAbortRef = useRef<AbortController | null>(null);
  const integrityRequestIdRef = useRef<string | null>(null);
  const inspectorProjectionAppliedRef = useRef<SessionState | null>(null);
  const activeProjectionAppliedRef = useRef<SessionState | null>(null);
  const presentationProjectionAppliedRef = useRef(new Map<string, string>());
  const windowProjectionChangedRef = useRef(false);
  const androidRestorationRef = useRef<{
    projection: SessionState;
    promise: Promise<ShellSession[]>;
  } | null>(null);
  const openedRestorationReferencesRef = useRef(new Set<string>());
  const selectedRecoveryGateway =
    recoveryGateway === undefined
      ? nativeRecoveryAvailable()
        ? nativeRecoveryGateway
        : null
      : recoveryGateway;
  const recovery = useRecovery(state.sessions, selectedRecoveryGateway);
  const recoveryCandidate = recovery.candidates[0] ?? null;
  const activeSession =
    state.sessions.find(({ id }) => id === state.activeId) ?? null;
  const selectedMetadataGateway = useMemo(
    () =>
      metadataGateway === undefined
        ? nativeMetadataAvailable()
          ? createNativeMetadataGateway()
          : null
        : metadataGateway,
    [metadataGateway],
  );
  const selectedPersistenceGateway = useMemo(
    () =>
      persistenceGateway === undefined
        ? nativePersistenceAvailable()
          ? nativePersistenceGateway
          : null
        : persistenceGateway,
    [persistenceGateway],
  );
  const persistence = usePersistence(
    state.sessions,
    state.activeId,
    applicationPanel === 'closed'
      ? inspectorOpen
        ? 'metadata'
        : 'closed'
      : applicationPanel,
    selectedPersistenceGateway,
    recovery.recordIds,
  );
  const selectedAndroidRestorationGateway =
    androidRestorationGateway === undefined
      ? nativeAndroidRestorationAvailable()
        ? nativeAndroidRestorationGateway
        : null
      : androidRestorationGateway;
  const selectedAndroidDeliveryGateway =
    androidDeliveryGateway === undefined
      ? nativeAndroidDeliveryAvailable()
        ? nativeAndroidDeliveryGateway
        : null
      : androidDeliveryGateway;
  const selectedDesktopDeliveryGateway =
    desktopDeliveryGateway === undefined
      ? nativeDesktopDeliveryAvailable()
        ? nativeDesktopDeliveryGateway
        : null
      : desktopDeliveryGateway;
  const openDesktopSourceIdsRef = useRef(new Set<string>());
  const openAndroidSourceIdsRef = useRef(new Set<string>());
  const pendingDesktopDeliveryProbesRef = useRef(new Map<string, number[]>());
  useEffect(() => {
    void reportDesktopLifecycleProbe('shell-ready').catch(() => undefined);
    if (nativeDesktopDeliveryAvailable())
      void runPackageWorkflowProbe().catch(() => {
        void reportPackageWorkflowFailure().catch(() => undefined);
      });
    if (/Windows/iu.test(navigator.userAgent))
      void reportDesktopDeviceScaleProbe(window.devicePixelRatio).catch(
        () => undefined,
      );
    void consumeDesktopMarkdownFailureProbe()
      .then((requested) => {
        if (requested) setMarkdownFailureProbe(true);
      })
      .catch(() => undefined);
  }, []);
  const applyDesktopDeliveries = useCallback(
    async (results: readonly DesktopDeliveryResult[]) => {
      if (!selectedDesktopDeliveryGateway) return;
      for (const result of results) {
        if (result.status === 'rejected') {
          setDeliveryError(
            result.error?.summary ?? 'The delivered file could not be opened.',
          );
          continue;
        }
        if (result.status === 'duplicate' && result.source) {
          dispatch({
            type: 'activate',
            id: `desktop-${result.source.source_id}`,
          });
          await reportDesktopLifecycleProbe(
            'delivery-ready',
            result.sequence,
          ).catch(() => false);
          continue;
        }
        try {
          const session =
            await selectedDesktopDeliveryGateway.materialize(result);
          if (session) {
            setDeliveryError('');
            const sourceId = session.source_id;
            if (sourceId) {
              const pending =
                pendingDesktopDeliveryProbesRef.current.get(sourceId) ?? [];
              pendingDesktopDeliveryProbesRef.current.set(sourceId, [
                ...pending,
                result.sequence,
              ]);
            }
            dispatch({ type: 'open', session });
          }
        } catch {
          if (result.source)
            void selectedDesktopDeliveryGateway.close(result.source.source_id);
          setDeliveryError(
            'The delivered file could not be decoded safely. Check that it is readable UTF-8 or UTF-16 text.',
          );
        }
      }
    },
    [selectedDesktopDeliveryGateway],
  );
  useEffect(() => {
    if (!selectedDesktopDeliveryGateway) return;
    let active = true;
    const drain = () => {
      void selectedDesktopDeliveryGateway
        .drain()
        .then((results) => {
          if (active) void applyDesktopDeliveries(results);
        })
        .catch(() => {
          if (active)
            setDeliveryError(
              'Desktop delivery is temporarily unavailable. Try Open again.',
            );
        });
    };
    let unlisten: (() => void) | undefined;
    void selectedDesktopDeliveryGateway
      .subscribe(drain)
      .then((dispose) => {
        if (active) {
          unlisten = dispose;
          drain();
        } else dispose();
      })
      .catch(() => {
        if (active)
          setDeliveryError(
            'Desktop delivery is temporarily unavailable. Try Open again.',
          );
      });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [applyDesktopDeliveries, selectedDesktopDeliveryGateway]);
  useEffect(() => {
    const active = state.sessions.find(
      (session) => session.id === state.activeId,
    );
    if (!active?.source_id) return;
    const pending = pendingDesktopDeliveryProbesRef.current.get(
      active.source_id,
    );
    if (!pending?.length) return;
    pendingDesktopDeliveryProbesRef.current.delete(active.source_id);
    for (const sequence of pending)
      void reportDesktopLifecycleProbe('delivery-ready', sequence).catch(
        () => undefined,
      );
  }, [state.activeId, state.sessions]);
  useEffect(() => {
    if (!selectedDesktopDeliveryGateway) return;
    const current = new Set(
      state.sessions
        .filter(
          (session) =>
            session.source_id && session.id === `desktop-${session.source_id}`,
        )
        .map((session) => session.source_id as string),
    );
    for (const sourceId of openDesktopSourceIdsRef.current) {
      if (!current.has(sourceId))
        void selectedDesktopDeliveryGateway.close(sourceId);
    }
    openDesktopSourceIdsRef.current = current;
  }, [selectedDesktopDeliveryGateway, state.sessions]);
  const applyAndroidDeliveries = useCallback(async () => {
    if (!selectedAndroidDeliveryGateway) return;
    const delivery = await selectedAndroidDeliveryGateway.drain();
    for (const rejection of delivery.rejections)
      setDeliveryError(
        `The delivered Android file could not be opened (${rejection.code}).`,
      );
    for (const source of delivery.sources) {
      try {
        const session =
          await selectedAndroidDeliveryGateway.materialize(source);
        setDeliveryError('');
        dispatch({ type: 'open', session });
      } catch {
        recordFailure('source', 'read', 'source_read_failed');
        void selectedAndroidDeliveryGateway.close(source.source_id);
        setDeliveryError(
          'The delivered Android file could not be decoded safely. Check that it is readable UTF-8 or UTF-16 text.',
        );
      }
    }
  }, [selectedAndroidDeliveryGateway]);
  useEffect(() => {
    if (!selectedAndroidDeliveryGateway) return;
    let active = true;
    const drain = () => {
      void applyAndroidDeliveries().catch(() => {
        if (active)
          setDeliveryError(
            'Android file delivery is temporarily unavailable. Open the file again.',
          );
      });
    };
    let unlisten: (() => void) | undefined;
    let fallbackTimer: ReturnType<typeof setInterval> | undefined;
    void selectedAndroidDeliveryGateway
      .subscribe(drain)
      .then((dispose) => {
        if (active) {
          unlisten = dispose;
        } else dispose();
      })
      .catch(() => {
        if (active) fallbackTimer = setInterval(drain, 500);
      })
      .finally(drain);
    return () => {
      active = false;
      unlisten?.();
      if (fallbackTimer !== undefined) clearInterval(fallbackTimer);
    };
  }, [applyAndroidDeliveries, selectedAndroidDeliveryGateway]);
  useEffect(() => {
    if (!selectedAndroidDeliveryGateway) return;
    const current = new Set(
      state.sessions
        .filter(
          (session) =>
            session.source_id &&
            (session.source.kind === 'document_uri' ||
              session.id === `android-${session.source_id}`),
        )
        .flatMap((session) => [
          session.source_id!,
          ...(session.copy_source ? [session.copy_source.source_id] : []),
        ]),
    );
    for (const session of state.sessions)
      if (session.copy_source) current.add(session.copy_source.source_id);
    for (const sourceId of openAndroidSourceIdsRef.current) {
      if (!current.has(sourceId))
        void selectedAndroidDeliveryGateway
          .close(sourceId)
          .catch(() => recordFailure('source', 'session', 'action_failed'));
    }
    openAndroidSourceIdsRef.current = current;
  }, [selectedAndroidDeliveryGateway, state.sessions]);
  useEffect(() => {
    const restored = persistence.restoredSession;
    if (!restored || !selectedAndroidRestorationGateway) return;
    if (androidRestorationRef.current?.projection !== restored) {
      androidRestorationRef.current = {
        projection: restored,
        promise: selectedAndroidRestorationGateway.restore(restored.sessions),
      };
    }
    let active = true;
    void androidRestorationRef.current.promise
      .then((restoredSessions) => {
        if (!active) return;
        for (const session of restoredSessions) {
          const reference = session.source.restoration_reference;
          if (
            !reference ||
            openedRestorationReferencesRef.current.has(reference)
          )
            continue;
          openedRestorationReferencesRef.current.add(reference);
          dispatch({ type: 'open', session });
        }
      })
      .catch(() => {
        if (active)
          setCommandStatus('Authorized Android sources could not be restored.');
      });
    return () => {
      active = false;
    };
  }, [persistence.restoredSession, selectedAndroidRestorationGateway]);
  useEffect(() => {
    const restored = persistence.restoredSession;
    const projectionFor = (
      session: ShellSession,
    ): SessionProjection | undefined =>
      restored?.sessions.find(
        (projection) =>
          Boolean(
            projection.source_reference &&
            projection.source_reference ===
              session.source.restoration_reference,
          ) ||
          Boolean(
            projection.recovery_record_id &&
            (session.id === `recovery-${projection.recovery_record_id}` ||
              recovery.recordIds.get(session.id) ===
                projection.recovery_record_id),
          ),
      );

    if (restored && inspectorProjectionAppliedRef.current !== restored) {
      inspectorProjectionAppliedRef.current = restored;
      if (!windowProjectionChangedRef.current) {
        const inspector = restored.window.inspector;
        setInspectorOpen(inspector === 'metadata');
        setApplicationPanel(
          inspector === 'preferences' || inspector === 'diagnostics'
            ? inspector
            : 'closed',
        );
      }
    }

    const activeProjection =
      !restored || restored.window.active_session_index === null
        ? undefined
        : restored.sessions[restored.window.active_session_index];
    const restoredActive = activeProjection
      ? state.sessions.find(
          (session) => projectionFor(session) === activeProjection,
        )
      : undefined;
    if (
      restored &&
      restoredActive &&
      activeProjectionAppliedRef.current !== restored
    ) {
      activeProjectionAppliedRef.current = restored;
      if (state.activeId !== restoredActive.id)
        dispatch({ type: 'activate', id: restoredActive.id });
    }

    for (const session of state.sessions) {
      const projection = projectionFor(session);
      if (session.image_document && projection?.image_presentation) {
        const image = projection.image_presentation;
        const signature = `${projection.session_key}:${JSON.stringify(image)}`;
        if (
          presentationProjectionAppliedRef.current.get(session.id) !== signature
        ) {
          presentationProjectionAppliedRef.current.set(session.id, signature);
          dispatch({
            type: 'update_image',
            id: session.id,
            expectedRevision: session.revision,
            image: {
              ...session.image_document,
              family_state: null,
              selection: image.selection,
              viewport: {
                mode: image.mode,
                zoom: image.zoom_milli / 1000,
                pan_x: image.pan_x,
                pan_y: image.pan_y,
                background: image.background,
              },
            },
          });
        }
        continue;
      }
      const desiredMode =
        projection?.presentation_mode ??
        (session.markdown_document
          ? session.edit_origin || session.integrity === 'recovery_only'
            ? session.markdown_document.mode
            : persistence.preferences.markdown_default_mode
          : null);
      if (desiredMode !== 'rendered' && desiredMode !== 'source') continue;
      const signature = `${projection?.session_key ?? 'default'}:${desiredMode}`;
      if (
        presentationProjectionAppliedRef.current.get(session.id) === signature
      )
        continue;
      presentationProjectionAppliedRef.current.set(session.id, signature);
      if (
        session.markdown_document &&
        session.markdown_document.mode !== desiredMode
      )
        dispatch({
          type: 'update_markdown',
          id: session.id,
          expectedRevision: session.revision,
          markdown: { ...session.markdown_document, mode: desiredMode },
        });
      if (
        session.mermaid_document &&
        session.mermaid_document.mode !== desiredMode
      )
        dispatch({
          type: 'update_mermaid',
          id: session.id,
          expectedRevision: session.revision,
          mermaid: { ...session.mermaid_document, mode: desiredMode },
        });
    }
  }, [
    persistence.preferences.markdown_default_mode,
    persistence.restoredSession,
    recovery.recordIds,
    state.activeId,
    state.sessions,
  ]);
  useEffect(() => {
    for (const session of state.sessions) {
      const decision = session.text_document?.language;
      const extension = normalizeExtension(
        session.source.display_name.split('.').at(-1) ?? '',
      );
      const language = extension
        ? persistence.preferences.language_overrides[extension]
        : undefined;
      if (
        !decision ||
        !language ||
        (decision.language === language &&
          decision.origin === 'session_override')
      )
        continue;
      dispatch({
        type: 'update_language',
        id: session.id,
        expectedRevision: session.revision,
        language: {
          ...decision,
          language,
          origin: 'session_override',
          status: language === 'plain_text' ? 'plain' : 'loading',
          load_revision: decision.load_revision + 1,
          fallback_code: null,
        },
      });
    }
  }, [persistence.preferences.language_overrides, state.sessions]);
  useEffect(() => {
    if (activeSession?.image_document?.status === 'failed')
      recordFailure('image', 'render', 'image_render_failed');
  }, [
    activeSession?.id,
    activeSession?.revision,
    activeSession?.image_document?.status,
  ]);
  const commands = commandSetFor(activeSession).filter(
    ({ id }) =>
      id !== 'save' ||
      (activeSession &&
        (Boolean(selectedAndroidDeliveryGateway) ||
          canSaveInPlace(activeSession))),
  );
  const resolutionSession = state.pendingTransition
    ? (state.sessions.find(
        ({ id }) => id === state.pendingTransition?.target_session_id,
      ) ?? null)
    : null;

  useEffect(() => setCommandStatus(''), [state.activeId]);

  useEffect(() => {
    if (
      (!inspectorOpen && !activeSession?.image_document) ||
      !activeSession?.source_id ||
      !selectedMetadataGateway
    ) {
      setMetadataReadySessionId(null);
      return;
    }
    setMetadataReadySessionId(null);
    const abort = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      void selectedMetadataGateway
        .query(activeSession.source_id!, abort.signal)
        .then((source) => {
          if (!abort.signal.aborted) {
            dispatch({
              type: 'refresh_metadata',
              id: activeSession.id,
              expectedRevision: activeSession.revision,
              expectedExternalRevision: activeSession.external_revision ?? null,
              source,
            });
            setMetadataReadySessionId(activeSession.id);
          }
        })
        .catch(() => {
          if (!abort.signal.aborted) {
            setMetadataReadySessionId(null);
            integrityAbortRef.current?.abort();
            dispatch({
              type: 'metadata_unavailable',
              id: activeSession.id,
              expectedRevision: activeSession.revision,
              sourceId: activeSession.source_id!,
            });
            setCommandStatus(
              'File information could not be refreshed. Source facts are unavailable.',
            );
          }
        })
        .finally(() => {
          if (!abort.signal.aborted) refreshTimer = setTimeout(refresh, 750);
        });
    };
    refresh();
    return () => {
      abort.abort();
      if (refreshTimer !== null) clearTimeout(refreshTimer);
    };
  }, [
    activeSession?.id,
    activeSession?.revision,
    activeSession?.source_id,
    inspectorOpen,
    selectedMetadataGateway,
  ]);

  useEffect(
    () => () => {
      integrityAbortRef.current?.abort();
      if (integrityRequestIdRef.current && selectedMetadataGateway)
        void selectedMetadataGateway
          .cancelIntegrity(integrityRequestIdRef.current)
          .catch(() => undefined);
      integrityAbortRef.current = null;
      integrityRequestIdRef.current = null;
    },
    [activeSession?.id, inspectorOpen, selectedMetadataGateway],
  );

  const openMetadata = (opener: HTMLElement) => {
    windowProjectionChangedRef.current = true;
    void editorRef.current?.invoke('close_search');
    metadataOpenerRef.current = opener;
    setApplicationPanel('closed');
    setInspectorOpen(true);
  };

  const closeMetadata = () => {
    integrityAbortRef.current?.abort();
    if (integrityRequestIdRef.current && selectedMetadataGateway)
      void selectedMetadataGateway
        .cancelIntegrity(integrityRequestIdRef.current)
        .catch(() => undefined);
    integrityAbortRef.current = null;
    integrityRequestIdRef.current = null;
    setInspectorOpen(false);
    const opener = metadataOpenerRef.current;
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus();
      else if (
        state.activeId &&
        document.getElementById(`tab-${state.activeId}`)
      )
        document.getElementById(`tab-${state.activeId}`)?.focus();
    });
  };

  const openApplicationPanel = (
    panel: 'preferences' | 'diagnostics',
    opener: HTMLButtonElement,
  ) => {
    windowProjectionChangedRef.current = true;
    void editorRef.current?.invoke('close_search');
    applicationOpenerRef.current = opener;
    setInspectorOpen(false);
    setApplicationPanel(panel);
  };

  const closeApplicationPanel = () => {
    windowProjectionChangedRef.current = true;
    setApplicationPanel('closed');
    requestAnimationFrame(() => {
      if (applicationOpenerRef.current?.isConnected)
        applicationOpenerRef.current.focus();
    });
  };

  const saveSession = async (
    session: ShellSession,
  ): Promise<import('./domain/commands').ActionResult> => {
    if (pendingActions.current.has(session.id))
      return { status: 'unavailable', reason: 'operation_pending' };
    pendingActions.current.add(session.id);
    const operationId = selectedAndroidDeliveryGateway
      ? undefined
      : createDesktopSaveOperationId();
    dispatch({
      type: 'destination_save_started',
      id: session.id,
      revision: session.revision,
      operationId,
    });
    setCommandStatus('Saving. Waiting for a verified native write receipt.');
    try {
      await recovery.flush().catch(() => undefined);
      if (!mountedRef.current)
        return { status: 'unavailable', reason: 'stale_session' };
      if (selectedAndroidDeliveryGateway) {
        const receipt = await androidAuthoringGateway.saveAs(session);
        if (!receipt)
          return { status: 'cancelled', reason: 'picker_cancelled' };
        if (!mountedRef.current) {
          await selectedAndroidDeliveryGateway
            .close(receipt.source.source_id)
            .catch(() => undefined);
          return { status: 'unavailable', reason: 'stale_session' };
        }
        openAndroidSourceIdsRef.current.add(receipt.source.source_id);
        dispatch({ type: 'destination_saved', id: session.id, receipt });
        return { status: 'performed' };
      }
      if (!selectedDesktopDeliveryGateway)
        return { status: 'unavailable', reason: 'native_save_unavailable' };
      const receipt = await selectedDesktopDeliveryGateway.save({
        ...session,
        destination_save_operation_id: operationId,
      });
      if (!mountedRef.current)
        return { status: 'unavailable', reason: 'stale_session' };
      if (
        receipt.operation_id !== operationId ||
        receipt.source_id !== session.source_id ||
        receipt.accepted_session_revision !== session.revision ||
        !externalRevisionMatches(
          receipt.previous_external_revision,
          session.external_revision,
        )
      )
        return { status: 'failed', reason: 'invalid_receipt' };
      const current = stateRef.current.sessions.find(
        (value) => value.id === session.id,
      );
      if (
        !current ||
        current.source_id !== session.source_id ||
        !externalRevisionMatches(
          current.external_revision,
          session.external_revision,
        )
      )
        return { status: 'failed', reason: 'source_changed' };
      dispatch({ type: 'save_completed', id: session.id, receipt });
      return { status: 'performed' };
    } catch (error) {
      recordFailure('action', 'write', 'action_failed');
      return { status: 'failed', reason: saveFailureReason(error) };
    } finally {
      pendingActions.current.delete(session.id);
      if (mountedRef.current)
        dispatch({ type: 'destination_save_finished', id: session.id });
    }
  };

  const invoke = async (
    command: CommandDescriptor,
    opener?: HTMLButtonElement,
  ) => {
    const current = () =>
      stateRef.current.sessions.find(
        (s) => s.id === stateRef.current.activeId,
      ) ?? null;
    const target = current();
    const result = await performCommand(command, current, async () => {
      if (!target) return false;
      if (command.id === 'save' || command.id === 'save_as') {
        if (command.id === 'save_as' && !selectedAndroidDeliveryGateway) {
          if (!selectedDesktopDeliveryGateway) return false;
          return (await selectedDesktopDeliveryGateway.saveAs(target))
            ? ({ status: 'performed' } as const)
            : ({ status: 'cancelled', reason: 'picker_cancelled' } as const);
        }
        return saveSession(target);
      }
      if (command.id === 'edit_copy') {
        dispatch({
          type: 'open',
          session: createDraftSession(
            target.markdown_document ? 'markdown' : 'text',
            target,
          ),
        });
        return true;
      }
      if (command.id === 'metadata') {
        if (!opener) return false;
        openMetadata(opener);
        return true;
      }
      return (await editorRef.current?.invoke(command.id)) ?? false;
    });
    if (!mountedRef.current) return;
    if (result.status === 'failed' || result.status === 'unavailable')
      recordFailure(
        'action',
        'execute',
        result.status === 'failed' ? 'action_failed' : 'action_unavailable',
      );
    const latest = stateRef.current.sessions.find((s) => s.id === target?.id);
    if (target && stateRef.current.activeId !== target.id) return;
    if (
      result.status === 'performed' &&
      (command.id === 'save' || command.id === 'save_as') &&
      latest &&
      target &&
      latest.revision !== target.revision
    ) {
      setCommandStatus('Saved earlier revision. Newer edits remain unsaved.');
      return;
    }
    setCommandStatus(
      result.status === 'performed'
        ? command.id === 'save' || command.id === 'save_as'
          ? 'Saved after native verification.'
          : 'Completed ' + command.label + '.'
        : result.status === 'cancelled'
          ? 'Cancelled. Your document and edits remain available.'
          : result.status === 'failed'
            ? command.id === 'save' || command.id === 'save_as'
              ? saveFailureMessage(result.reason)
              : 'The action failed. Your document and edits remain available.'
            : 'This action is unavailable for the current document.',
    );
  };

  const chooseDesktopSources = () => {
    if (!selectedDesktopDeliveryGateway) return;
    setDeliveryError('');
    void selectedDesktopDeliveryGateway
      .choose()
      .then(applyDesktopDeliveries)
      .catch(() =>
        setDeliveryError(
          'The native Open dialog is unavailable. Try again or open the file from your desktop.',
        ),
      );
  };

  const publishMetadata = (contribution: MetadataContribution) =>
    dispatch({ type: 'update_metadata', contribution });

  const requestChecksum = () => {
    const inspectedRevision = activeSession?.metadata?.external_revision;
    if (
      !activeSession?.source_id ||
      !inspectedRevision ||
      metadataReadySessionId !== activeSession.id ||
      !selectedMetadataGateway
    )
      return;
    integrityAbortRef.current?.abort();
    const abort = new AbortController();
    integrityAbortRef.current = abort;
    const requestId = createIntegrityRequestId();
    if (!requestId) {
      setCommandStatus(
        'SHA-256 is unavailable because secure request identifiers are not supported.',
      );
      return;
    }
    integrityRequestIdRef.current = requestId;
    const base = {
      session_id: activeSession.id,
      expected_session_revision: activeSession.revision,
      expected_external_revision: inspectedRevision,
      producer: 'integrity' as const,
    };
    publishMetadata({
      ...base,
      facts: [
        { key: 'derived.sha256', availability: 'pending' },
        {
          key: 'derived.sha256_progress',
          availability: 'available',
          value: { kind: 'integer', value: '0' },
          unit: 'bytes',
        },
      ],
    });
    void runIntegrityRequest(
      selectedMetadataGateway,
      activeSession.source_id,
      inspectedRevision,
      requestId,
      abort.signal,
      (progress) =>
        publishMetadata({
          ...base,
          facts: [
            { key: 'derived.sha256', availability: 'pending' },
            {
              key: 'derived.sha256_progress',
              availability: 'available',
              value: {
                kind: 'integer',
                value: String(progress.processed_bytes),
              },
              unit: 'bytes',
            },
          ],
        }),
    )
      .then((progress) => {
        if (abort.signal.aborted) return;
        integrityRequestIdRef.current = null;
        publishMetadata({
          ...base,
          facts:
            progress.state === 'ready' && progress.sha256
              ? [
                  {
                    key: 'derived.sha256',
                    availability: 'available',
                    value: { kind: 'text', value: progress.sha256 },
                  },
                  {
                    key: 'derived.sha256_progress',
                    availability: 'not_provided',
                  },
                ]
              : progress.state === 'limited'
                ? [
                    { key: 'derived.sha256', availability: 'unsupported' },
                    {
                      key: 'derived.sha256_progress',
                      availability: 'not_provided',
                    },
                  ]
                : [
                    {
                      key: 'derived.sha256',
                      availability: 'errored',
                      error_code: `integrity_${progress.state}`,
                    },
                    {
                      key: 'derived.sha256_progress',
                      availability: 'not_provided',
                    },
                  ],
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        integrityRequestIdRef.current = null;
        publishMetadata({
          ...base,
          facts: [
            {
              key: 'derived.sha256',
              availability: 'errored',
              error_code: 'integrity_failed',
            },
            { key: 'derived.sha256_progress', availability: 'not_provided' },
          ],
        });
      });
  };

  const resolveRecoveryCandidate = (decision: RecoveryCandidateDecision) => {
    if (!recoveryCandidate) return;
    if (decision === 'cancel') {
      recovery.defer(recoveryCandidate);
      return;
    }
    if (decision === 'refuse') {
      void recovery.refuse(recoveryCandidate).catch(() => {
        setCommandStatus(
          'Recovery refusal could not be confirmed. The record was preserved.',
        );
      });
      return;
    }
    void recovery
      .accept(recoveryCandidate)
      .then((record) => {
        dispatch({
          type: 'open',
          session: projectRecoveredSession({
            inventory: recoveryCandidate,
            content: record.content,
            snapshot_session_revision: record.snapshot_session_revision,
            text_profile: record.text_profile,
          }),
        });
      })
      .catch(() => {
        setCommandStatus(
          'Recovery could not be opened. The record was preserved.',
        );
      });
  };

  const resolveDestructiveTransition = (
    decision: 'save' | 'save_as' | 'discard' | 'cancel',
  ) => {
    if (!resolutionSession || pendingActions.current.has(resolutionSession.id))
      return;
    if (
      selectedAndroidDeliveryGateway &&
      (decision === 'save' || decision === 'save_as')
    ) {
      dispatch({ type: 'resolve_transition', decision: 'save_as' });
      void saveSession(resolutionSession).then((result) => {
        if (!mountedRef.current) return;
        if (result.status !== 'performed')
          dispatch({ type: 'resolve_transition', decision: 'cancel' });
        setCommandStatus(
          result.status === 'performed'
            ? 'Saved after native verification.'
            : result.status === 'cancelled'
              ? 'Save cancelled. Edits remain open.'
              : saveFailureMessage(result.reason),
        );
      });
      return;
    }
    if (
      !selectedDesktopDeliveryGateway ||
      (decision !== 'save' && decision !== 'save_as')
    ) {
      dispatch({ type: 'resolve_transition', decision });
      return;
    }
    dispatch({ type: 'resolve_transition', decision });
    if (decision === 'save') {
      void saveSession(resolutionSession).then((result) => {
        if (result.status !== 'performed')
          dispatch({ type: 'resolve_transition', decision: 'cancel' });
      });
      return;
    }
    void selectedDesktopDeliveryGateway
      .saveAs(resolutionSession)
      .then((saved) =>
        dispatch({
          type: 'resolve_transition',
          decision: saved ? 'discard' : 'cancel',
        }),
      )
      .catch(() => {
        dispatch({ type: 'resolve_transition', decision: 'cancel' });
        setCommandStatus('Save As failed. Edits remain open.');
      });
  };

  const chooseSources = async () => {
    if (!selectedAndroidDeliveryGateway) {
      chooseDesktopSources();
      return;
    }
    setDeliveryError('');
    try {
      const source = await selectedAndroidDeliveryGateway.choose?.();
      if (!source) return;
      try {
        dispatch({
          type: 'open',
          session: await selectedAndroidDeliveryGateway.materialize(source),
        });
      } catch (error) {
        await selectedAndroidDeliveryGateway.close(source.source_id);
        throw error;
      }
    } catch {
      recordFailure('source', 'delivery', 'source_delivery_failed');
      setDeliveryError(
        'This file could not be opened. Check access or choose it again.',
      );
    }
  };

  const handleShellKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key === 'Tab') {
      event.preventDefault();
      dispatch({ type: event.shiftKey ? 'previous' : 'next' });
      return;
    }
    if (modifier && key === 'w' && state.activeId) {
      event.preventDefault();
      dispatch({ type: 'close', id: state.activeId });
      return;
    }
    const id = modifier
      ? (
          {
            s: 'save',
            c: 'copy',
            f: 'search',
            g: 'go_to_line',
            p: 'print',
            z: event.shiftKey ? 'redo' : 'undo',
            '+': 'zoom_in',
            '=': 'zoom_in',
            '-': 'zoom_out',
          } as const
        )[key as 's']
      : event.key === 'F3'
        ? event.shiftKey
          ? 'find_previous'
          : 'find_next'
        : event.key === 'PageUp'
          ? 'previous_page'
          : event.key === 'PageDown'
            ? 'next_page'
            : undefined;
    const command = commands.find((c) => c.id === id && c.enabled);
    if (command) {
      event.preventDefault();
      void invoke(command);
    }
  };

  const backHandler = useRef<(requestId: string) => void>(() => undefined);
  backHandler.current = (requestId) => {
    let handled = true;
    const frame = document.querySelector<HTMLElement>('[data-bb-app-frame]');
    const ime =
      Number.parseFloat(
        getComputedStyle(frame ?? document.documentElement).getPropertyValue(
          '--bb-ime-block-end',
        ),
      ) || 0;
    const menu = document.querySelector<HTMLElement>(
      '.application-menu[role="menu"]',
    );
    const search = document.querySelector<HTMLElement>(
      '.cm-search,[role="search"]',
    );
    if (ime > 0 && document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    else if (addDocumentOpen) setAddDocumentOpen(false);
    else if (recoveryCandidate) resolveRecoveryCandidate('cancel');
    else if (state.pendingTransition) resolveDestructiveTransition('cancel');
    else if (applicationPanel !== 'closed') {
      if (!document.querySelector('.application-sheet[aria-busy="true"]'))
        closeApplicationPanel();
    } else if (inspectorOpen) closeMetadata();
    else if (menu)
      menu.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
    else if (search)
      void Promise.resolve(editorRef.current?.invoke('close_search')).catch(
        () => recordFailure('action', 'execute', 'action_failed'),
      );
    else if (state.activeId) dispatch({ type: 'close', id: state.activeId });
    else handled = false;
    void selectedAndroidDeliveryGateway
      ?.completeBack?.(requestId, handled)
      .catch(() => undefined);
  };
  useEffect(() => {
    if (!selectedAndroidDeliveryGateway?.subscribeBack) return;
    let active = true;
    let dispose: (() => void) | undefined;
    void selectedAndroidDeliveryGateway
      .subscribeBack((id) => backHandler.current(id))
      .then((fn) => {
        if (active) dispose = fn;
        else fn();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      dispose?.();
    };
  }, [selectedAndroidDeliveryGateway]);

  return (
    <>
      <AppFrameEnvironmentBridge layoutResizeCanBeIme={layoutResizeCanBeIme} />
      <AppFrame host="tauri" layout="full-bleed">
        <div
          className="app-shell"
          data-android={Boolean(selectedAndroidDeliveryGateway)}
          data-has-draft-identity={Boolean(activeSession?.edit_origin)}
          inert={addDocumentOpen}
          data-has-tabs={state.sessions.length > 1 ? 'true' : 'false'}
          data-performance-ready="true"
          onKeyDown={handleShellKey}
        >
          <div
            className="shell-chrome"
            data-has-tabs={state.sessions.length > 1 ? 'true' : 'false'}
          >
            <ApplicationMenu
              active={applicationPanel === 'closed' && !inspectorOpen}
              commands={commands}
              canOpen={Boolean(
                selectedDesktopDeliveryGateway ||
                (selectedAndroidDeliveryGateway &&
                  typeof selectedAndroidDeliveryGateway.choose === 'function'),
              )}
              onOpen={() => void chooseSources()}
              onInvoke={(command, opener) => void invoke(command, opener)}
              onPreferences={(opener) =>
                openApplicationPanel('preferences', opener)
              }
              onDiagnostics={(opener) =>
                openApplicationPanel('diagnostics', opener)
              }
            />
            <TabStrip state={state} dispatch={dispatch} />
          </div>
          {activeSession?.edit_origin && (
            <div className="draft-identity" data-draft-identity role="status">
              <span>{activeSession.source.display_name}</span>
              <span>
                {activeSession.destination_save_revision != null
                  ? 'Saving…'
                  : activeSession.dirty
                    ? 'Unsaved changes'
                    : 'Saved'}
              </span>
            </div>
          )}
          {deliveryError && (
            <aside className="delivery-error" role="alert">
              {deliveryError}
            </aside>
          )}
          {activeSession &&
            (integrityOf(activeSession) === 'conflicted' ||
              integrityOf(activeSession) === 'recovery_only') && (
              <aside
                className="integrity-banner"
                role="status"
                aria-live="polite"
              >
                {integrityOf(activeSession) === 'recovery_only'
                  ? 'Recovered local edits have no confirmed source authority. Save As is available.'
                  : 'The source changed outside Glitchpad. Local edits remain available; in-place save is blocked.'}
              </aside>
            )}
          {recovery.warning && (
            <aside
              className="integrity-banner"
              role="status"
              aria-live="assertive"
            >
              {recovery.warning}
            </aside>
          )}
          {persistence.warning && (
            <aside
              className="integrity-banner persistence-warning"
              role="status"
              aria-live="polite"
            >
              {persistence.warning}
            </aside>
          )}
          <PreferenceContext.Provider value={persistence.preferences}>
            <DocumentSurface
              ref={editorRef}
              onFailure={(component, stage, reason) =>
                window.dispatchEvent(
                  new CustomEvent('glitchpad:failure', {
                    detail: { component, stage, reason },
                  }),
                )
              }
              session={activeSession}
              markdownFailureProbe={markdownFailureProbe}
              recoveryProbeGeneration={recoveryProbeGeneration}
              canOpen={Boolean(selectedDesktopDeliveryGateway)}
              onOpen={chooseDesktopSources}
              labelledByTab={state.sessions.length > 1}
              onDocumentChange={(id, expectedRevision, document, revision) =>
                dispatch({
                  type: 'update_text',
                  id,
                  expectedRevision,
                  document,
                  revision,
                })
              }
              onLanguageChange={(id, expectedRevision, language) => {
                dispatch({
                  type: 'update_language',
                  id,
                  expectedRevision,
                  language,
                });
                const target = state.sessions.find(
                  (session) => session.id === id,
                );
                const extension = target?.source.display_name.split('.').at(-1);
                const normalized = extension
                  ? normalizeExtension(extension)
                  : null;
                if (normalized && language.origin === 'session_override') {
                  persistence.updatePreferences({
                    ...persistence.preferences,
                    language_overrides: {
                      ...persistence.preferences.language_overrides,
                      [normalized]: language.language,
                    },
                  });
                }
              }}
              onMarkdownChange={(id, expectedRevision, markdown) =>
                dispatch({
                  type: 'update_markdown',
                  id,
                  expectedRevision,
                  markdown,
                })
              }
              onMermaidChange={(id, expectedRevision, mermaid) =>
                dispatch({
                  type: 'update_mermaid',
                  id,
                  expectedRevision,
                  mermaid,
                })
              }
              externalLinkGateway={
                externalLinkGateway ??
                (nativeExternalLinkAvailable()
                  ? nativeMarkdownExternalLinkGateway
                  : undefined)
              }
              localAssetGateway={localAssetGateway}
              onOpenMetadata={openMetadata}
              onMetadataContribution={publishMetadata}
              onImageChange={(id, expectedRevision, image) =>
                dispatch({ type: 'update_image', id, expectedRevision, image })
              }
            />
          </PreferenceContext.Provider>
          {inspectorOpen && activeSession && (
            <MetadataInspector
              key={activeSession.id}
              session={activeSession}
              snapshot={projectSessionMetadata(activeSession)}
              onClose={closeMetadata}
              onRequestChecksum={
                activeSession.source_id &&
                activeSession.metadata?.external_revision &&
                metadataReadySessionId === activeSession.id &&
                selectedMetadataGateway
                  ? requestChecksum
                  : undefined
              }
              clipboardGateway={clipboardGateway}
            />
          )}
          {applicationPanel === 'preferences' && (
            <PreferencesPanel
              value={persistence.preferences}
              onChange={persistence.updatePreferences}
              onReset={() => void persistence.reset('preferences')}
              onClose={closeApplicationPanel}
            />
          )}
          {applicationPanel === 'diagnostics' && (
            <DiagnosticsPanel
              load={persistence.previewDiagnostics}
              exporter={
                diagnosticExportGateway ??
                (selectedAndroidDeliveryGateway
                  ? nativeAndroidDiagnosticExportGateway
                  : browserDiagnosticExportGateway)
              }
              onReset={() => persistence.reset('diagnostics')}
              onClose={closeApplicationPanel}
            />
          )}
          {!recoveryCandidate &&
            state.pendingTransition &&
            resolutionSession && (
              <RecoveryResolution
                session={resolutionSession}
                transition={state.pendingTransition}
                onDecision={resolveDestructiveTransition}
              />
            )}
          {recoveryCandidate && (
            <RecoveryCandidateResolution
              entry={recoveryCandidate}
              onDecision={resolveRecoveryCandidate}
            />
          )}
          <p
            className={commandStatus ? 'command-result' : 'visually-hidden'}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {commandStatus || state.announcement}
          </p>
        </div>
        {selectedAndroidDeliveryGateway && (
          <AddDocumentMenu
            open={addDocumentOpen}
            onOpenChange={setAddDocumentOpen}
            onNew={(kind) =>
              dispatch({ type: 'open', session: createDraftSession(kind) })
            }
            onChoose={() => void chooseSources()}
            canChoose={
              typeof selectedAndroidDeliveryGateway.choose === 'function'
            }
            disabled={
              applicationPanel !== 'closed' ||
              inspectorOpen ||
              Boolean(state.pendingTransition) ||
              Boolean(recoveryCandidate)
            }
          />
        )}
      </AppFrame>
    </>
  );
}
