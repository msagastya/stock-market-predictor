'use client';

import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error) {
        console.error('ErrorBoundary caught:', error);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div style={{
                    padding: '20px',
                    background: 'var(--surface)',
                    border: '1px solid #3f1515',
                    borderRadius: 8,
                    color: 'var(--text2)',
                    fontSize: 13,
                }}>
                    <div style={{ color: 'var(--red)', fontWeight: 500, marginBottom: 8 }}>Something went wrong</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{this.state.error?.message}</div>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => this.setState({ hasError: false })}
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
