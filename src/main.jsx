import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { resetToDefaults } from "./repositories/backupRepository.js";
import "./styles.css";

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
      await resetToDefaults();
      window.location.reload();
    } catch (error) {
      console.error("Failed to reset app after crash.", error);
      this.setState({ resetting: false });
    }
  };

  render() {
    if (this.state.error) {
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
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
