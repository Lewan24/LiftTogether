import { Component, type ReactNode, type ErrorInfo } from "react";
export default class ErrorBoundary extends Component<
  {
    children: ReactNode;
  },
  {
    failed: boolean;
  }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Connect redacted error telemetry here. */
  }
  render() {
    return this.state.failed ? (
      <main className="loading-state grid min-h-dvh place-items-center">
        <div role="alert">
          <h1>Something went wrong</h1>
          <p>Please reload the application.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}
