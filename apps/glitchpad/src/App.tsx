import { AppFrameHostBridge } from './components/AppFrameHostBridge';
import { useNativeViewport } from './components/use-native-viewport';
import { createDesktopSaveOperationId } from './domain/desktop-delivery-gateway';
import { externalRevisionMatches } from './domain/contracts';
import {
  installRecoveryProbeListener,
  RECOVERY_BUILD_VARIANT,
  FRONTEND_BUILD_COMMIT,
} from './domain/recovery-probes';
import { TaskSurface, dismissTopTaskSurface } from './components/TaskSurface';
import { AboutPanel } from './components/AboutPanel';
import { useCompactLayout } from './components/use-compact-layout';
import {
  nativeApplicationInfoGateway,
  type ApplicationInfoGateway,
  type ApplicationInfo,
} from './domain/application-info';
import {
  saveFailureReason,
  saveFailureMessage,
} from './domain/android-authoring-gateway';
import { recordFailure } from './domain/diagnostic-failures';
import { markSaveObservation } from './domain/save-observation-probes';
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
import type {
  TextEditorHandle,
  EditorCommandState,
} from './components/TextEditorSurface';
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
  type CommandId,
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

const ownedAndroidSourceIds = (
  sessions: readonly ShellSession[],
): Set<string> => {
  const current = new Set(
    sessions
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
  for (const session of sessions)
    if (session.copy_source) current.add(session.copy_source.source_id);
  return current;
};

const contextualCommandIds: readonly CommandId[] = [
  'search',
  'find_next',
  'find_previous',
  'close_search',
  'go_to_line',
  'zoom_in',
  'zoom_out',
  'fit',
  'edit',
  'outline',
  'metadata',
  'document_details',
  'large_text_tools',
];

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
  applicationInfoGateway?: ApplicationInfoGateway;
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
  // MainActivity already resizes the WebView for the IME; reserve only visual obstruction.
  layoutResizeCanBeIme = false,
  applicationInfoGateway = nativeApplicationInfoGateway,
}: AppProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(tabReducer, sessions, createTabState);
  const [commandFeedback, setCommandFeedback] = useState<{
    text: string;
    contextual: boolean;
    announce?: boolean;
  }>({ text: '', contextual: false });
  const commandStatus = commandFeedback.text;
  const commandStatusVisible =
    Boolean(commandStatus) && !commandFeedback.contextual;
  const setCommandStatus = useCallback(
    (text: string) => setCommandFeedback({ text, contextual: false }),
    [],
  );
  const { compact, short } = useCompactLayout();
  const [addTriggerHost, setAddTriggerHost] = useState<HTMLElement | null>(
    null,
  );
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const documentsOpener = useRef<HTMLButtonElement>(null);
  const [installedInfo, setInstalledInfo] = useState<ApplicationInfo | null>(
    null,
  );
  const [editorCommandState, setEditorCommandState] =
    useState<EditorCommandState>({ undo: false, redo: false, wrapped: true });
  useEffect(() => {
    let active = true;
    void applicationInfoGateway
      .info()
      .then((info) => {
        if (active) setInstalledInfo(info);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [applicationInfoGateway]);
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
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [applicationPanel, setApplicationPanel] = useState<
    'closed' | 'preferences' | 'diagnostics' | 'help' | 'about'
  >('closed');
  const [metadataReadySessionId, setMetadataReadySessionId] = useState<
    string | null
  >(null);
  const editorRef = useRef<TextEditorHandle>(null);
  const metadataOpenerRef = useRef<HTMLElement | null>(null);
  const applicationOpenerRef = useRef<HTMLButtonElement | null>(null);
  const integrityAbortRef = useRef<AbortController | null>(null);
  const integrityRequestIdRef = useRef<string | null>(null);
  const integrityPendingRef = useRef<MetadataContribution | null>(null);
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
      : applicationPanel === 'about' || applicationPanel === 'help'
        ? 'closed'
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
  useNativeViewport(
    shellRef,
    selectedAndroidDeliveryGateway
      ? (diagnosticExportGateway?.viewport ??
          (nativeAndroidDeliveryAvailable()
            ? nativeAndroidDiagnosticExportGateway.viewport
            : undefined))
      : undefined,
    '--gl-shell-native',
  );
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
          recordFailure('source', 'delivery', 'source_delivery_failed');
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
          recordFailure('source', 'read', 'source_read_failed');
          if (result.source)
            void selectedDesktopDeliveryGateway
              .close(result.source.source_id)
              .catch(() => undefined);
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
          if (active) return applyDesktopDeliveries(results);
        })
        .catch(() => {
          if (active) {
            recordFailure('source', 'delivery', 'source_delivery_failed');
            setDeliveryError(
              'Desktop delivery is temporarily unavailable. Try Open again.',
            );
          }
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
        if (active) {
          recordFailure('source', 'delivery', 'source_delivery_failed');
          setDeliveryError(
            'Desktop delivery is temporarily unavailable. Try Open again.',
          );
        }
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
    for (const session of state.sessions)
      if (session.copy_source) current.add(session.copy_source.source_id);
    for (const sourceId of openDesktopSourceIdsRef.current) {
      if (!current.has(sourceId))
        void selectedDesktopDeliveryGateway.close(sourceId);
    }
    openDesktopSourceIdsRef.current = current;
  }, [selectedDesktopDeliveryGateway, state.sessions]);
  const applyAndroidDeliveries = useCallback(async () => {
    if (!selectedAndroidDeliveryGateway) return;
    const delivery = await selectedAndroidDeliveryGateway.drain();
    for (const rejection of delivery.rejections) {
      recordFailure('source', 'delivery', 'source_delivery_failed');
      setDeliveryError(
        `The delivered Android file could not be opened (${rejection.code}).`,
      );
    }
    for (const source of delivery.sources) {
      try {
        const session =
          await selectedAndroidDeliveryGateway.materialize(source);
        setDeliveryError('');
        dispatch({ type: 'open', session });
      } catch {
        recordFailure('source', 'read', 'source_read_failed');
        if (
          !ownedAndroidSourceIds(stateRef.current.sessions).has(
            source.source_id,
          )
        )
          void selectedAndroidDeliveryGateway
            .close(source.source_id)
            .catch(() => undefined);
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
        if (active) {
          recordFailure('source', 'delivery', 'source_delivery_failed');
          setDeliveryError(
            'Android file delivery is temporarily unavailable. Open the file again.',
          );
        }
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
        if (active) {
          recordFailure('source', 'delivery', 'source_delivery_failed');
          fallbackTimer = setInterval(drain, 500);
        }
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
    const current = ownedAndroidSourceIds(state.sessions);
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
    if (!persistence.ready) return;
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
      const signature = projection
        ? `${projection.session_key}:${desiredMode}`
        : 'default';
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
    persistence.ready,
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
  const commands = commandSetFor(activeSession, editorCommandState).filter(
    ({ id }) =>
      (id !== 'print' || !selectedAndroidDeliveryGateway) &&
      (id !== 'save' ||
        (activeSession &&
          (Boolean(selectedAndroidDeliveryGateway) ||
            canSaveInPlace(activeSession)))),
  );
  const resolutionSession = state.pendingTransition
    ? (state.sessions.find(
        ({ id }) => id === state.pendingTransition?.target_session_id,
      ) ?? null)
    : null;

  useEffect(() => setCommandStatus(''), [state.activeId]);
  useEffect(() => setInspectorExpanded(false), [state.activeId]);

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
    setInspectorExpanded(false);
    windowProjectionChangedRef.current = true;
    void editorRef.current?.invoke('close_search');
    metadataOpenerRef.current = opener;
    setApplicationPanel('closed');
    setMenuOpen(false);
    setToolsOpen(false);
    setDocumentsOpen(false);
    setInspectorOpen(true);
  };

  const closeMetadata = () => {
    setInspectorExpanded(false);
    integrityAbortRef.current?.abort();
    if (integrityRequestIdRef.current && selectedMetadataGateway)
      void selectedMetadataGateway
        .cancelIntegrity(integrityRequestIdRef.current)
        .catch(() => undefined);
    integrityAbortRef.current = null;
    integrityRequestIdRef.current = null;
    const pending = integrityPendingRef.current;
    integrityPendingRef.current = null;
    if (pending)
      publishMetadata({
        ...pending,
        facts: [
          { key: 'derived.sha256', availability: 'not_provided' },
          { key: 'derived.sha256_progress', availability: 'not_provided' },
        ],
      });
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
    panel: 'preferences' | 'diagnostics' | 'help' | 'about',
    opener: HTMLButtonElement,
  ) => {
    windowProjectionChangedRef.current = true;
    void editorRef.current?.invoke('close_search');
    applicationOpenerRef.current = opener;
    setInspectorOpen(false);
    setMenuOpen(false);
    setToolsOpen(false);
    setDocumentsOpen(false);
    setApplicationPanel(panel);
  };

  const closeApplicationPanel = () => {
    windowProjectionChangedRef.current = true;
    setApplicationPanel('closed');
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
      markSaveObservation(session, 'save_session_catch');
      recordFailure('action', 'write', 'action_failed');
      return { status: 'failed', reason: saveFailureReason(error) };
    } finally {
      markSaveObservation(session, 'save_session_finally');
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
      return (await editorRef.current?.invoke(command.id, opener)) ?? false;
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
    if (
      result.status === 'performed' &&
      contextualCommandIds.includes(command.id)
    ) {
      setCommandFeedback({
        text: 'Completed ' + command.label + '.',
        contextual: true,
        announce: command.id === 'edit',
      });
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
      .catch(() => {
        recordFailure('source', 'delivery', 'source_delivery_failed');
        setDeliveryError(
          'The native Open dialog is unavailable. Try again or open the file from your desktop.',
        );
      });
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
    integrityPendingRef.current = { ...base, facts: [] };
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
      (progress) => {
        if (abort.signal.aborted || integrityRequestIdRef.current !== requestId)
          return;
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
        });
      },
    )
      .then((progress) => {
        if (abort.signal.aborted || integrityRequestIdRef.current !== requestId)
          return;
        integrityRequestIdRef.current = null;
        integrityPendingRef.current = null;
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
        if (abort.signal.aborted || integrityRequestIdRef.current !== requestId)
          return;
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        integrityRequestIdRef.current = null;
        integrityPendingRef.current = null;
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
    const transition = stateRef.current.pendingTransition;
    const session = stateRef.current.sessions.find(
      (value) => value.id === transition?.target_session_id,
    );
    if (!transition || !session || pendingActions.current.has(session.id))
      return;
    if (
      (decision === 'save' || decision === 'save_as') &&
      session.revision !== transition.requested_session_revision
    ) {
      setCommandStatus('');
      dispatch({ type: 'resolve_transition', decision });
      return;
    }
    if (
      selectedAndroidDeliveryGateway &&
      (decision === 'save' || decision === 'save_as')
    ) {
      dispatch({ type: 'resolve_transition', decision: 'save_as' });
      void saveSession(session).then((result) => {
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
      void saveSession(session).then((result) => {
        if (result.status !== 'performed')
          dispatch({ type: 'resolve_transition', decision: 'cancel' });
      });
      return;
    }
    void selectedDesktopDeliveryGateway
      .saveAs(session)
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
    let readingSource = false;
    try {
      const source = await selectedAndroidDeliveryGateway.choose?.();
      if (!source) return;
      readingSource = true;
      try {
        dispatch({
          type: 'open',
          session: await selectedAndroidDeliveryGateway.materialize(source),
        });
      } catch (error) {
        if (
          !ownedAndroidSourceIds(stateRef.current.sessions).has(
            source.source_id,
          )
        )
          await selectedAndroidDeliveryGateway.close(source.source_id);
        throw error;
      }
    } catch {
      recordFailure(
        'source',
        readingSource ? 'read' : 'delivery',
        readingSource ? 'source_read_failed' : 'source_delivery_failed',
      );
      setDeliveryError(
        'This file could not be opened. Check access or choose it again.',
      );
    }
  };

  const handleShellKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    const editableTarget =
      event.target instanceof Element
        ? event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
          )
        : null;
    if (
      editableTarget &&
      !editableTarget.matches('.document-surface .cm-content')
    )
      return;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key === 'Tab') {
      event.preventDefault();
      dispatch({ type: event.shiftKey ? 'previous' : 'next' });
      return;
    }
    if (modifier && key === 'w' && state.activeId) {
      event.preventDefault();
      setMenuOpen(false);
      setToolsOpen(false);
      setDocumentsOpen(false);
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
          } as Partial<Record<string, CommandId>>
        )[key]
      : event.key === 'F3'
        ? event.shiftKey
          ? 'find_previous'
          : 'find_next'
        : event.key === 'PageUp'
          ? 'previous_page'
          : event.key === 'PageDown'
            ? 'next_page'
            : undefined;
    const advertised = commands.find((command) => command.id === id);
    const historySession = stateRef.current.sessions.find(
      (session) => session.id === stateRef.current.activeId,
    );
    // CodeMirror updates history synchronously, before React publishes toolbar state.
    const command =
      advertised && (id === 'undo' || id === 'redo')
        ? historySession && !pendingActions.current.has(historySession.id)
          ? commandSetFor(
              historySession,
              editorRef.current?.commandState?.(),
            ).find((candidate) => candidate.id === id && candidate.enabled)
          : undefined
        : advertised?.enabled
          ? advertised
          : undefined;
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
    const search = document.querySelector<HTMLElement>(
      '.cm-search,[role="search"]',
    );
    if (ime > 0 && document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    else if (addDocumentOpen) setAddDocumentOpen(false);
    else if (recoveryCandidate) resolveRecoveryCandidate('cancel');
    else if (state.pendingTransition) resolveDestructiveTransition('cancel');
    else if (dismissTopTaskSurface()) {
      /* One controlled top task layer. */
    } else if (applicationPanel !== 'closed') {
      if (!document.querySelector('.application-sheet[aria-busy="true"]'))
        closeApplicationPanel();
    } else if (inspectorOpen) closeMetadata();
    else if (menuOpen) setMenuOpen(false);
    else if (toolsOpen) setToolsOpen(false);
    else if (documentsOpen) setDocumentsOpen(false);
    else if (!editorRef.current?.dismissModal?.()) {
      if (search)
        void Promise.resolve(editorRef.current?.invoke('close_search')).catch(
          () => recordFailure('action', 'execute', 'action_failed'),
        );
      else if (state.activeId) dispatch({ type: 'close', id: state.activeId });
      else handled = false;
    }
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

  const draftStatus =
    activeSession?.destination_save_revision != null
      ? 'Saving…'
      : activeSession?.dirty
        ? 'Unsaved changes'
        : 'Saved';
  const draftSymbol =
    activeSession?.destination_save_revision != null
      ? '…'
      : activeSession?.dirty
        ? '•'
        : '✓';
  return (
    <>
      <AppFrameEnvironmentBridge layoutResizeCanBeIme={layoutResizeCanBeIme} />
      <AppFrameHostBridge />
      <AppFrame host="tauri" layout="full-bleed">
        <div
          ref={shellRef}
          className="app-shell"
          data-android={Boolean(selectedAndroidDeliveryGateway)}
          data-compact={compact}
          data-short={short}
          aria-hidden={addDocumentOpen ? true : undefined}
          data-command-result-visible={commandStatusVisible}
          data-build-variant={RECOVERY_BUILD_VARIANT}
          data-frontend-source-commit={FRONTEND_BUILD_COMMIT ?? 'unavailable'}
          data-native-source-commit={
            installedInfo?.build_commit ?? 'unavailable'
          }
          data-has-draft-identity={
            Boolean(activeSession?.edit_origin) && !compact
          }
          inert={
            addDocumentOpen ||
            menuOpen ||
            toolsOpen ||
            documentsOpen ||
            applicationPanel !== 'closed' ||
            (inspectorOpen && compact) ||
            Boolean(state.pendingTransition) ||
            Boolean(recoveryCandidate)
          }
          data-has-tabs={state.sessions.length > 1 ? 'true' : 'false'}
          data-performance-ready="true"
          onKeyDown={handleShellKey}
        >
          <div
            className="shell-chrome"
            data-has-tabs={state.sessions.length > 1 ? 'true' : 'false'}
          >
            <ApplicationMenu
              active={
                applicationPanel === 'closed' &&
                !inspectorOpen &&
                !addDocumentOpen &&
                !state.pendingTransition &&
                !recoveryCandidate
              }
              condensed={compact}
              commands={commands}
              open={menuOpen}
              onOpenChange={setMenuOpen}
              toolsOpen={toolsOpen}
              onToolsOpenChange={setToolsOpen}
              onHelp={(opener) => openApplicationPanel('help', opener)}
              onAbout={(opener) => openApplicationPanel('about', opener)}
              viewport={diagnosticExportGateway?.viewport}
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
            <div
              className="active-document-identity"
              data-testid="active-document-identity"
              data-draft-identity={
                compact && activeSession?.edit_origin ? true : undefined
              }
              title={activeSession?.source.display_name ?? 'Glitchpad'}
            >
              <span>{activeSession?.source.display_name ?? 'Glitchpad'}</span>
              {compact && activeSession?.edit_origin && (
                <span
                  className="draft-status-inline"
                  role="status"
                  title={draftStatus}
                >
                  <span aria-hidden="true">{draftSymbol}</span>
                  <span className="visually-hidden">{draftStatus}</span>
                </span>
              )}
              {activeSession?.dirty &&
                !(compact && activeSession.edit_origin) && (
                  <span aria-label="Unsaved changes"> •</span>
                )}
            </div>
            {compact && state.sessions.length > 1 && (
              <button
                type="button"
                className="document-count-trigger"
                ref={documentsOpener}
                aria-haspopup="dialog"
                aria-label={state.sessions.length + ' documents'}
                title={state.sessions.length + ' open documents'}
                aria-expanded={documentsOpen}
                onClick={() => setDocumentsOpen(true)}
              >
                {state.sessions.length}
                <span className="visually-hidden"> documents</span>
              </button>
            )}
            {!compact && state.sessions.length > 1 && (
              <TabStrip state={state} dispatch={dispatch} />
            )}
            {compact && selectedAndroidDeliveryGateway && (
              <span className="shell-add-control" ref={setAddTriggerHost} />
            )}
          </div>
          {!compact && activeSession?.edit_origin && (
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
              labelledByTab={!compact && state.sessions.length > 1}
              onCommandStateChange={setEditorCommandState}
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
                if (normalized) {
                  const languageOverrides = {
                    ...persistence.preferences.language_overrides,
                  };
                  if (language.origin === 'session_override')
                    languageOverrides[normalized] = language.language;
                  else delete languageOverrides[normalized];
                  persistence.updatePreferences({
                    ...persistence.preferences,
                    language_overrides: languageOverrides,
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
            <TaskSurface
              open
              className={
                inspectorExpanded ? 'file-info-task expanded' : 'file-info-task'
              }
              title="File information"
              onOpenChange={(open) => {
                if (!open) closeMetadata();
              }}
              opener={metadataOpenerRef.current}
              modal={compact}
              viewport={diagnosticExportGateway?.viewport}
            >
              <MetadataInspector
                embedded
                onExpandedChange={setInspectorExpanded}
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
            </TaskSurface>
          )}
          {applicationPanel === 'preferences' && (
            <TaskSurface
              open
              canClose={!applicationBusy}
              title="Preferences"
              opener={applicationOpenerRef.current}
              onOpenChange={(open) => {
                if (
                  !open &&
                  !document.querySelector(
                    '.application-sheet[aria-busy="true"]',
                  )
                )
                  closeApplicationPanel();
              }}
              viewport={diagnosticExportGateway?.viewport}
            >
              <PreferencesPanel
                embedded
                onBusyChange={setApplicationBusy}
                value={persistence.preferences}
                onChange={persistence.updatePreferences}
                onReset={() => persistence.reset('preferences')}
                onClose={closeApplicationPanel}
              />
            </TaskSurface>
          )}
          {applicationPanel === 'diagnostics' && (
            <TaskSurface
              open
              canClose={!applicationBusy}
              title="Diagnostics"
              opener={applicationOpenerRef.current}
              onOpenChange={(open) => {
                if (
                  !open &&
                  !document.querySelector(
                    '.application-sheet[aria-busy="true"]',
                  )
                )
                  closeApplicationPanel();
              }}
              viewport={diagnosticExportGateway?.viewport}
            >
              <DiagnosticsPanel
                embedded
                onBusyChange={setApplicationBusy}
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
            </TaskSurface>
          )}
          {(applicationPanel === 'about' || applicationPanel === 'help') && (
            <TaskSurface
              open
              title={
                applicationPanel === 'about'
                  ? 'About Glitchpad'
                  : 'Help and support'
              }
              opener={applicationOpenerRef.current}
              onOpenChange={(open) => {
                if (!open) closeApplicationPanel();
              }}
              viewport={diagnosticExportGateway?.viewport}
            >
              <AboutPanel
                gateway={applicationInfoGateway}
                external={externalLinkGateway}
                help={applicationPanel === 'help'}
              />
            </TaskSurface>
          )}
          <TaskSurface
            open={documentsOpen}
            title="Open documents"
            opener={documentsOpener.current}
            onOpenChange={setDocumentsOpen}
            viewport={diagnosticExportGateway?.viewport}
          >
            <div className="document-switcher">
              {state.sessions.map((session) => (
                <div key={session.id}>
                  <button
                    type="button"
                    aria-current={
                      session.id === state.activeId ? 'true' : undefined
                    }
                    onClick={() => {
                      dispatch({ type: 'activate', id: session.id });
                      setDocumentsOpen(false);
                    }}
                  >
                    {session.source.display_name}
                    {session.dirty ? ' (unsaved)' : ''}
                  </button>
                  <button
                    type="button"
                    aria-label={'Close ' + session.source.display_name}
                    onClick={() => {
                      dispatch({ type: 'close', id: session.id });
                      setDocumentsOpen(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              ))}
            </div>
          </TaskSurface>
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
            className={
              commandStatusVisible ? 'command-result' : 'visually-hidden'
            }
            role="status"
            aria-live={
              commandFeedback.contextual && !commandFeedback.announce
                ? 'off'
                : 'polite'
            }
            aria-atomic="true"
          >
            {commandStatus || state.announcement}
          </p>
        </div>
        {selectedAndroidDeliveryGateway && (
          <AddDocumentMenu
            triggerHost={compact ? addTriggerHost : null}
            open={addDocumentOpen}
            onOpenChange={setAddDocumentOpen}
            onNew={(kind) =>
              dispatch({ type: 'open', session: createDraftSession(kind) })
            }
            onChoose={() => void chooseSources()}
            canChoose={
              typeof selectedAndroidDeliveryGateway.choose === 'function'
            }
            viewport={
              diagnosticExportGateway?.viewport ??
              (nativeAndroidDeliveryAvailable()
                ? nativeAndroidDiagnosticExportGateway.viewport
                : undefined)
            }
            disabled={
              applicationPanel !== 'closed' ||
              menuOpen ||
              toolsOpen ||
              documentsOpen ||
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
