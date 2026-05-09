import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-box" style={{ margin: '4rem auto', maxWidth: 480 }}>
        <div className="error-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <path d="M12 9v4" />
            <circle cx="12" cy="17" r="0.6" fill="currentColor"/>
          </svg>
        </div>
        <div className="error-title">Something went wrong</div>
        <div className="error-hint">{String(this.state.error?.message || this.state.error)}</div>
        <button className="btn btn-search" style={{ marginTop: '1rem' }} onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
