import { Component, Suspense, type ReactNode } from 'react';

interface ReadBoundaryProps {
  children: ReactNode;
  /** Shown while reading, and instead of the children if the read fails. */
  fallback?: ReactNode;
  /** Logged with the error when the read fails. */
  failure: string;
  /** For a part that can't stay on screen without its read. */
  onFailure?: () => void;
}

/**
 * Around a part that reads stored data as it renders: the fallback until the read is in,
 * and if it fails, the fallback stays and the rest of the app carries on. A new `key`
 * tries the read again.
 */
export function ReadBoundary({ children, fallback = null, ...failed }: ReadBoundaryProps) {
  return (
    <FailedReadBoundary fallback={fallback} {...failed}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </FailedReadBoundary>
  );
}

// React catches a render's errors only in a class component.
class FailedReadBoundary extends Component<ReadBoundaryProps, { hasFailed: boolean }> {
  state = { hasFailed: false };

  static getDerivedStateFromError() {
    return { hasFailed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(this.props.failure, error);
    this.props.onFailure?.();
  }

  render() {
    return this.state.hasFailed ? this.props.fallback : this.props.children;
  }
}
