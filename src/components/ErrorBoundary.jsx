import React from 'react';
import { reportError } from '../utils/monitoring';

const CRASH_TITLE = 'Something went wrong';
const RELOAD_LABEL = 'Reload';

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
    reportError(error, { componentStack: info?.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-box" style={{ margin: '4rem auto', maxWidth: 480 }}>
        <div className="error-icon">⚠️</div>
        <div className="error-title">{CRASH_TITLE}</div>
        <div className="error-hint">{String(this.state.error?.message || this.state.error)}</div>
        <button className="btn btn-search" style={{ marginTop: '1rem' }} onClick={() => location.reload()}>
          {RELOAD_LABEL}
        </button>
      </div>
    );
  }
}
