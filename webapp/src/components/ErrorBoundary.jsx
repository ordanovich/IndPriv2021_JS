import React from "react";

// Catches an unexpected error in the part of the app it wraps, so one
// failing piece does not blank the whole page. `fallback` is what to show
// instead (default nothing); `onError` lets the parent react (e.g. close the
// failing tool and tell the user).
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(error, info?.componentStack);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) return this.props.fallback ?? null;
    return this.props.children;
  }
}

// Last resort for the whole app. It cannot rely on the app state (that may be
// what broke), so it is bilingual and reloads the current link.
export function CrashScreen() {
  return (
    <div className="crash-screen" role="alert">
      <p><strong>Se ha producido un error inesperado.</strong><br />Vuelva a cargar el visor; se conservará la vista actual.</p>
      <p lang="en"><strong>An unexpected error occurred.</strong><br />Reload the viewer; the current view will be kept.</p>
      <button onClick={() => window.location.reload()}>Volver a cargar · Reload</button>
    </div>
  );
}
