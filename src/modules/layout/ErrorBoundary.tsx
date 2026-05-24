import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pushLog } from "@/modules/shared/utils";

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    pushLog("error", "react", `${error.message}\n${info?.componentStack ?? ""}`);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Card className="p-6 max-w-xl mx-auto mt-10 border-destructive/40" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
          <AlertTriangle className="size-5" />
          Что-то пошло не так
        </div>
        <pre className="text-xs whitespace-pre-wrap text-muted-foreground mb-4 max-h-60 overflow-auto">
          {this.state.error.message}
        </pre>
        <div className="flex gap-2">
          <Button size="sm" onClick={this.reset}>Попробовать снова</Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Перезагрузить
          </Button>
        </div>
      </Card>
    );
  }
}