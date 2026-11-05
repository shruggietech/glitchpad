import {installFailureCapture} from './domain/diagnostic-failures';
import './runtime-polyfills';
import './bootstrap.css';
import { bootstrapApplication } from './bootstrap-recovery';

installFailureCapture();

void bootstrapApplication(
  document.getElementById('root'),
  () => import('./application'),
);
