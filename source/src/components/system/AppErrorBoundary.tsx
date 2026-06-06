import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to your monitoring / telemetry sink here.
    console.error("App error boundary caught:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="p-8 max-w-xl mx-auto mt-12 rounded-lg border border-destructive/30 bg-destructive/5">
        <h1 className="text-lg font-semibold text-destructive">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mt-2">
          The app hit an unexpected error. Try a hard refresh; if it persists, reach out to
          your administrator with the details below.
        </p>
        <pre className="mt-4 text-xs whitespace-pre-wrap bg-card border rounded p-3 max-h-64 overflow-auto">
          {this.state.message}
        </pre>
        <button
          className="mt-4 px-3 py-1.5 rounded-md border bg-card text-sm hover:bg-muted"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}