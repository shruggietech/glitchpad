import { Component, type ErrorInfo, type ReactNode } from 'react';

interface DocumentErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
  fallback: (context: { error: Error; reset: () => void }) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface DocumentErrorBoundaryState {
  error: Error | null;
}

export class DocumentErrorBoundary extends Component<
  DocumentErrorBoundaryProps,
  DocumentErrorBoundaryState
> {
  state: DocumentErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DocumentErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(previous: DocumentErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private readonly reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}
