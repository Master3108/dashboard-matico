import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    handleReset = () => {
        // Limpiar localStorage y recargar
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    backgroundColor: '#1a1a2e',
                    color: '#fff',
                    fontFamily: 'monospace'
                }}>
                    <div style={{
                        maxWidth: '800px',
                        width: '100%',
                        backgroundColor: '#16213e',
                        borderRadius: '16px',
                        padding: '32px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                    }}>
                        <h1 style={{ color: '#ff6b6b', marginBottom: '16px', fontSize: '28px' }}>
                            ⚠️ Error Crítico Detectado
                        </h1>

                        <p style={{ color: '#a0a0a0', marginBottom: '24px' }}>
                            La aplicación encontró un problema. Aquí está la información del error:
                        </p>

                        <div style={{
                            backgroundColor: '#0f0f23',
                            padding: '16px',
                            borderRadius: '8px',
                            marginBottom: '24px',
                            overflowX: 'auto'
                        }}>
                            <h3 style={{ color: '#ffd93d', marginBottom: '8px' }}>Error:</h3>
                            <pre style={{ color: '#ff6b6b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {this.state.error && this.state.error.toString()}
                            </pre>
                        </div>

                        <div style={{
                            backgroundColor: '#0f0f23',
                            padding: '16px',
                            borderRadius: '8px',
                            marginBottom: '24px',
                            maxHeight: '300px',
                            overflowY: 'auto'
                        }}>
                            <h3 style={{ color: '#ffd93d', marginBottom: '8px' }}>Stack Trace:</h3>
                            <pre style={{ color: '#4ecdc4', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {this.state.errorInfo && this.state.errorInfo.componentStack}
                            </pre>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: '#4ecdc4',
                                    color: '#1a1a2e',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '16px'
                                }}
                            >
                                🔄 Limpiar Datos y Reiniciar
                            </button>

                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: '#6c5ce7',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '16px'
                                }}
                            >
                                🔃 Solo Recargar
                            </button>
                        </div>

                        <p style={{ color: '#666', marginTop: '24px', fontSize: '12px' }}>
                            Si el problema persiste después de limpiar los datos, contacta al soporte técnico
                            con la información del error mostrada arriba.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
