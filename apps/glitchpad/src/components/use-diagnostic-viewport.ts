import type { RefObject } from 'react';
import type { DiagnosticExportGateway } from '../domain/persistence-gateway';
import { useNativeViewport } from './use-native-viewport';

export function useDiagnosticViewport(
  ref: RefObject<HTMLElement | null>,
  read: DiagnosticExportGateway['viewport'],
) {
  useNativeViewport(ref, read, '--gl-diagnostic');
}
