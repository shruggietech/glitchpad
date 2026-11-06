import { Dialog } from 'radix-ui';
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  nativeAndroidDiagnosticExportGateway,
  type DiagnosticExportGateway,
} from '../domain/persistence-gateway';
import { nativeAndroidDeliveryAvailable } from '../domain/android-delivery-gateway';
import { useNativeViewport } from './use-native-viewport';
import './TaskSurface.css';

const TaskDepth = createContext(0);
const layers = new Map<
  symbol,
  {
    depth: number;
    priority: number;
    order: number;
    element: () => HTMLElement | null;
    close: () => void;
  }
>();
let order = 0;
const orderedLayers = () =>
  [...layers.values()].sort(
    (a, b) => b.priority - a.priority || b.depth - a.depth || b.order - a.order,
  );
/** Called only by the application's existing native Back owner. */
export function dismissTopTaskSurface(): boolean {
  const layer = orderedLayers()[0];
  if (!layer) return false;
  layer.close();
  return true;
}
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  viewport?: DiagnosticExportGateway['viewport'];
  opener?: HTMLElement | null;
  modal?: boolean;
  className?: string;
  canClose?: boolean;
  showClose?: boolean;
  priority?: 'normal' | 'decision';
}
export function TaskSurface({
  open,
  onOpenChange,
  title,
  children,
  viewport,
  opener,
  modal = true,
  className = '',
  canClose = true,
  showClose = true,
  priority = 'normal',
}: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const bindContent = useCallback((node: HTMLDivElement | null) => {
    content.current = node;
    setElement(node);
  }, []);
  const depth = useContext(TaskDepth);
  const level = priority === 'decision' ? 60 : 20;
  const id = useRef(Symbol('task'));
  const change = useRef(onOpenChange);
  change.current = onOpenChange;
  const allowed = useRef(canClose);
  allowed.current = canClose;
  useEffect(() => {
    if (!open || !host) return;
    const key = id.current;
    layers.set(key, {
      depth,
      priority: level,
      order: ++order,
      element: () => content.current,
      close: () => {
        if (allowed.current) change.current(false);
      },
    });
    return () => {
      layers.delete(key);
    };
  }, [open, host, depth, level]);
  useEffect(() => setHost(document.getElementById('bb-overlay-root')), []);
  useNativeViewport(
    content,
    open && element
      ? (viewport ??
          (nativeAndroidDeliveryAvailable()
            ? nativeAndroidDiagnosticExportGateway.viewport
            : undefined))
      : undefined,
    '--gl-task-native',
  );
  useEffect(() => {
    if (!element) return;
    const heading = element.querySelector<HTMLElement>('.task-surface-heading');
    const body = element.querySelector<HTMLElement>('.task-surface-body');
    if (!heading || !body) return;
    const measure = () => {
      const style = getComputedStyle(body);
      const values = [
        [
          '--gl-task-heading-block-size',
          heading.getBoundingClientRect().height,
        ],
        [
          '--gl-task-body-padding-block',
          (Number.parseFloat(style.paddingTop) || 0) +
            (Number.parseFloat(style.paddingBottom) || 0),
        ],
      ] as const;
      for (const [name, value] of values) {
        const next = value + 'px';
        if (element.style.getPropertyValue(name) !== next)
          element.style.setProperty(name, next);
      }
      const available =
        Number.parseFloat(
          element.style.getPropertyValue('--gl-task-native-block-size'),
        ) ||
        host?.getBoundingClientRect().height ||
        window.innerHeight;
      element.dataset.taskShort = available < 320 ? 'true' : 'false';
    };
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(heading);
    observer?.observe(body);
    const mutations = new MutationObserver(measure);
    mutations.observe(element, {
      attributes: true,
      attributeFilter: ['style'],
    });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [element, host]);
  if (!host) return null;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (value || canClose) onOpenChange(value);
      }}
      modal={modal}
    >
      <Dialog.Portal container={host}>
        {modal && (
          <Dialog.Overlay
            className="task-surface-scrim"
            style={{ zIndex: level + depth * 2 }}
          />
        )}
        <Dialog.Content
          ref={bindContent}
          className={'task-surface ' + className}
          aria-describedby={undefined}
          aria-modal={modal || undefined}
          style={{ zIndex: level + 1 + depth * 2 }}
          onEscapeKeyDown={(event) => {
            if (event.defaultPrevented) return;
            event.preventDefault();
            // Keep Escape on the same owned layer order as native Back.
            dismissTopTaskSurface();
          }}
          onPointerDownOutside={(event) => {
            if (!canClose) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (!modal) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            const target = content.current?.querySelector<HTMLElement>(
              '[data-task-initial-focus],[role=menuitem]:not([disabled])',
            );
            if (target) {
              event.preventDefault();
              target.focus({ preventScroll: true });
            }
          }}
          data-task-modal={modal ? 'true' : 'false'}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = opener?.isConnected
              ? opener
              : document.getElementById('bb-main');
            const remainingModal = orderedLayers()
              .map((layer) => layer.element())
              .find(
                (node) =>
                  node?.dataset.state === 'open' &&
                  node.dataset.taskModal === 'true',
              );
            if (remainingModal && (!target || !remainingModal.contains(target)))
              return;
            target?.focus({ preventScroll: true });
          }}
        >
          <header className="task-surface-heading">
            <Dialog.Title>{title}</Dialog.Title>
            {showClose && (
              <Dialog.Close disabled={!canClose} aria-label={'Close ' + title}>
                Close
              </Dialog.Close>
            )}
          </header>
          <TaskDepth.Provider value={depth + 1}>
            <div className="task-surface-body">{children}</div>
          </TaskDepth.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
