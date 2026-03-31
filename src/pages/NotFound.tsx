import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("404: Rota não encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold font-mono text-primary">404</h1>
        <p className="text-lg text-muted-foreground">Página não encontrada</p>
        <Link
          to="/"
          className="inline-block text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
