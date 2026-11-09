import React, { Component, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logSafeError } from "@/lib/safe-logger";

type Props = {
  children: ReactNode;
  route?: string;
  fallbackTitle?: string;
  fallbackDesc?: string;
  onReset?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class CustomerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logSafeError(this.props.route || "customer-panel", error);
    if (process.env.NODE_ENV === "development") {
      console.error("[CustomerErrorBoundary] Caught rendering error:", error, errorInfo);
    }
  }

  handleReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center p-8 bg-background rounded-2xl border border-border/80 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {this.props.fallbackTitle || "Não foi possível carregar esta página."}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {this.props.fallbackDesc ||
                "Encontramos um problema temporário. Tente novamente ou volte para sua conta."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tentar novamente</span>
              </button>
              <Link
                to="/conta"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-border bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition"
              >
                Voltar para minha conta
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
