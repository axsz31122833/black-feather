import React from 'react'

type Props = { children: React.ReactNode }

type State = { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App render error:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined })
    location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0d12', color: '#fff', padding: 24 }}>
          <div style={{ maxWidth: 560, width: '100%' }}>
            <h1 style={{ fontSize: 24, marginBottom: 12 }}>頁面發生錯誤</h1>
            <p style={{ opacity: 0.8, marginBottom: 16 }}>請稍後再試，或重新載入頁面。</p>
            <button onClick={this.handleReload} style={{ background: '#f59e0b', color: '#0b0d12', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 600 }}>重新載入</button>
            {this.state.error && (
              <pre style={{ marginTop: 16, background: '#111827', color: '#d1d5db', padding: 12, borderRadius: 8, overflowX: 'auto' }}>{this.state.error.message}</pre>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

