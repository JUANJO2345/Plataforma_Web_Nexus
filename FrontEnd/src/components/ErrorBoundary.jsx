import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL_UI_EXCEPTION:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] p-8 flex flex-col items-center justify-center text-center">
          <div className="border border-error/50 bg-error-container/10 p-8 max-w-xl w-full shadow-[0_0_30px_rgba(255,80,80,0.2)]">
            <span className="material-symbols-outlined text-error text-[48px] mb-2 block animate-pulse">
              error_med
            </span>
            <h2 className="font-display text-[22px] text-error font-bold uppercase tracking-wider mb-2">
              SYSTEM_FAULT_DETECTED
            </h2>
            <p className="font-mono-label text-[12px] text-on-surface-variant mb-4">
              Se ha producido un error inesperado al renderizar este módulo de la interfaz.
            </p>
            {this.state.error && (
              <div className="font-mono text-[11px] text-error bg-surface-container-highest p-3 text-left overflow-x-auto mb-4 border border-error/20">
                {String(this.state.error.message || this.state.error)}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 font-mono-label text-[11px] font-bold uppercase border border-primary bg-primary/20 text-primary hover:bg-primary hover:text-black transition-all cursor-pointer"
            >
              Reiniciar Módulo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
