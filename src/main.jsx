import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

// Folder mode never imports or mounts the legacy persistence/editor graph.
const folderMode = new URLSearchParams(window.location.search).get("library") === "folder";
const App = React.lazy(() => import("./App"));
const SafeModeRecovery = React.lazy(() => import("./components/SafeModeRecovery.jsx"));
const FolderLibrary = React.lazy(() => import("./components/FolderLibrary.jsx"));

function isSafeModeRecoveryEnabled() {
  try {
    return new URLSearchParams(window.location.search).get("safeMode") === "1";
  } catch {
    return false;
  }
}

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      resetting: false
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App render failed.", error, errorInfo);
  }

  handleReset = async () => {
    this.setState({ resetting: true });

    try {
      if (folderMode) return;
      const { resetToDefaults } = await import("./repositories/backupRepository.js");
      await resetToDefaults();
      window.location.reload();
    } catch (error) {
      console.error("Failed to reset app after crash.", error);
      this.setState({ resetting: false });
    }
  };

  render() {
    if (this.state.error) {
      if (folderMode) {
        return <main className="safe-mode-recovery-shell"><h1>Folder library could not be displayed.</h1><p>No library data was changed.</p><a href={window.location.pathname}>Return to browser library</a></main>;
      }
      return (
        <main className="app-shell crash-state">
          <div className="crash-panel panel">
            <p className="eyebrow">Runtime recovery</p>
            <h1>Moodboard failed to render.</h1>
            <p>
              Saved local state is likely incompatible with the current app. Resetting local library data usually
              fixes the blank screen.
            </p>
            <div className="crash-actions">
              <button type="button" className="primary-button" onClick={this.handleReset} disabled={this.state.resetting}>
                {this.state.resetting ? "Resetting..." : "Reset local data"}
              </button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <React.Suspense fallback={<p role="status">Loading…</p>}>
        {folderMode ? <FolderLibrary /> : isSafeModeRecoveryEnabled() ? <SafeModeRecovery /> : <App />}
      </React.Suspense>
    </RootErrorBoundary>
  </React.StrictMode>
);
