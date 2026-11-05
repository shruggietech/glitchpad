export type SaveObservationStage =
  | 'create_invoke_started'
  | 'create_invoke_resolved'
  | 'create_gateway_catch'
  | 'picker_cancelled_classified'
  | 'save_session_catch'
  | 'save_session_finally';

export interface SaveObservationSnapshot {
  generation: number;
  create_invoke_started: boolean;
  create_invoke_resolved: boolean;
  create_gateway_catch: boolean;
  picker_cancelled_classified: boolean;
  save_session_catch: boolean;
  save_session_finally: boolean;
  sdk_registry_available: boolean;
  sdk_pair_available: boolean;
  sdk_same_registry: boolean | null;
  success_entry_still_registered: boolean | null;
  error_entry_still_registered: boolean | null;
  sdk_callback_entry_observed: false;
}

interface CallbackPair {
  registry: Map<unknown, unknown>;
  successKey: unknown;
  successEntry: unknown;
  errorKey: unknown;
  errorEntry: unknown;
}
interface SaveObservation {
  owner: object;
  generation: number;
  stages: Record<SaveObservationStage, boolean>;
  pair: CallbackPair | null;
}
let current: SaveObservation | null = null;
let generation = 0;

const sdkRegistry = (): Map<unknown, unknown> | null => {
  const sdk: unknown = Reflect.get(window, '__TAURI_INTERNALS__');
  if (!sdk || typeof sdk !== 'object') return null;
  const callbacks: unknown = Reflect.get(sdk, 'callbacks');
  return callbacks instanceof Map ? callbacks : null;
};

const readObservation = (): SaveObservationSnapshot | null => {
  try {
    if (!current) return null;
    const registry = sdkRegistry();
    const pair = current.pair;
    const sameRegistry = pair ? registry === pair.registry : null;
    return {
      generation: current.generation,
      create_invoke_started: current.stages.create_invoke_started,
      create_invoke_resolved: current.stages.create_invoke_resolved,
      create_gateway_catch: current.stages.create_gateway_catch,
      picker_cancelled_classified: current.stages.picker_cancelled_classified,
      save_session_catch: current.stages.save_session_catch,
      save_session_finally: current.stages.save_session_finally,
      sdk_registry_available: registry !== null,
      sdk_pair_available: pair !== null,
      sdk_same_registry: sameRegistry,
      success_entry_still_registered:
        pair && sameRegistry
          ? registry!.get(pair.successKey) === pair.successEntry
          : null,
      error_entry_still_registered:
        pair && sameRegistry
          ? registry!.get(pair.errorKey) === pair.errorEntry
          : null,
      // Entry removal alone cannot prove that an SDK callback was entered.
      sdk_callback_entry_observed: false,
    };
  } catch {
    return null;
  }
};

/** Compiled S046 instrumentation only. Reads SDK entries without replacing them. */
export const observeCreateInvoke = <T>(
  owner: object,
  call: () => Promise<T>,
): Promise<T> => {
  if (import.meta.env.VITE_GLITCHPAD_RECOVERY_PROBES !== '1') return call();
  let observation: SaveObservation | null = null;
  let registry: Map<unknown, unknown> | null = null;
  let before: Set<unknown> | null = null;
  try {
    observation = {
      owner,
      generation: ++generation,
      stages: {
        create_invoke_started: true,
        create_invoke_resolved: false,
        create_gateway_catch: false,
        picker_cancelled_classified: false,
        save_session_catch: false,
        save_session_finally: false,
      },
      pair: null,
    };
    current = observation;
    Object.defineProperty(window, '__GLITCHPAD_SAVE_OBSERVATION__', {
      configurable: true,
      get: readObservation,
    });
    registry = sdkRegistry();
    if (registry) before = new Set(registry.keys());
  } catch {
    // Observation setup must not prevent or alter the actual invocation.
  }
  const result = call();
  try {
    if (observation && registry && before && sdkRegistry() === registry) {
      const added = [...registry.keys()].filter((key) => !before.has(key));
      if (added.length === 2) {
        const successEntry = registry.get(added[0]);
        const errorEntry = registry.get(added[1]);
        if (
          typeof successEntry === 'function' &&
          typeof errorEntry === 'function'
        )
          observation.pair = {
            registry,
            successKey: added[0],
            successEntry,
            errorKey: added[1],
            errorEntry,
          };
      }
    }
  } catch {
    // Pinned Tauri registers success then error synchronously. Ambiguous observations stay unavailable.
  }
  return result;
};

export const markSaveObservation = (
  owner: object,
  stage: SaveObservationStage,
): void => {
  if (import.meta.env.VITE_GLITCHPAD_RECOVERY_PROBES !== '1') return;
  try {
    if (current?.owner === owner) current.stages[stage] = true;
  } catch {
    // Stage observation cannot replace the application result or exception.
  }
};
