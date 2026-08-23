import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Barreira global de erros de renderização: evita tela branca e oferece
 * recuperação amigável. Não exibe detalhes técnicos do erro ao usuário.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Erro inesperado na interface:", error);
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="grid min-h-dvh place-items-center px-5">
        <div className="w-full max-w-[430px] rounded-2xl border border-ink-700 bg-ink-850 p-6 text-center">
          <p className="font-display text-2xl uppercase text-fog">Algo deu errado</p>
          <p className="mt-2 text-[13px] text-fog-dim">
            Ocorreu um erro inesperado na interface. Seus dados de treino continuam salvos.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={this.reset}
              className="w-full rounded-xl bg-volt-400 py-3 font-display uppercase text-ink-950"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-xl border border-ink-700 py-3 text-[12px] font-bold text-volt-300"
            >
              Recarregar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
