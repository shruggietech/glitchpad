import {
  loadApplicationWithRecoveryProbe,
  RECOVERY_BUILD_VARIANT,
  FRONTEND_BUILD_COMMIT,
} from './domain/recovery-probes';
import { installFailureCapture } from './domain/diagnostic-failures';
import './runtime-polyfills';
import './bootstrap.css';
import { bootstrapApplication } from './bootstrap-recovery';

installFailureCapture();
const productRoot = document.getElementById('root');
if (productRoot) {
  productRoot.dataset.buildVariant = RECOVERY_BUILD_VARIANT;
  if (FRONTEND_BUILD_COMMIT)
    productRoot.dataset.frontendSourceCommit = FRONTEND_BUILD_COMMIT;
}

void bootstrapApplication(document.getElementById('root'), () =>
  loadApplicationWithRecoveryProbe(() => import('./application')),
);
