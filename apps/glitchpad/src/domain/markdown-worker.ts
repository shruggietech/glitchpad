import type {
  MarkdownRenderRequest,
  MarkdownRenderResult,
} from './markdown-contract';
import { renderMarkdown } from './markdown-pipeline';

interface WorkerScope {
  onmessage: ((event: MessageEvent<MarkdownRenderRequest>) => void) | null;
  postMessage(result: MarkdownRenderResult): void;
}

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = (event) => {
  void renderMarkdown(event.data).then((result) => workerScope.postMessage(result));
};
