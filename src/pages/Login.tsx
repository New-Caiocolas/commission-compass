import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    setIsLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Atmospheric background extras */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm px-4 sm:px-0 animate-slide-up">
        {/* Header */}
        <div className="mb-8 text-center space-y-1">
          <h1 className="font-mono text-4xl font-bold text-primary text-glow tracking-tighter">
            ello
          </h1>
          <p className="text-xs text-muted-foreground tracking-widest uppercase font-medium">
            Comissão sobre Notas Liquidadas
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border/60 rounded-lg p-5 sm:p-8 space-y-5 shadow-2xl">
          {/* Status */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/60 rounded-full px-3 py-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Sistema Online
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground tracking-wide uppercase">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="usuario@empresa.com"
                className="bg-secondary border-border/60 focus:border-primary focus:ring-primary/20 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground tracking-wide uppercase">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="bg-secondary border-border/60 focus:border-primary focus:ring-primary/20 transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive border border-destructive/20 bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-primary transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  Entrando…
                </span>
              ) : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
