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
        <div className="error-icon">⚠️</div>
        <div className="error-title">Something went wrong</div>
        <div className="error-hint">{String(this.state.error?.message || this.state.error)}</div>
        <button className="btn btn-search" style={{ marginTop: '1rem' }} onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
