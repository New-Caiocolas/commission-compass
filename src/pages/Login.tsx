import { useState, useRef } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Sanitize email: trim and lowercase. Never allow > 254 chars (RFC 5321).
function sanitizeEmail(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 254);
}

// Passwords must not exceed 128 chars to prevent bcrypt DoS.
const MAX_PASSWORD_LENGTH = 128;

// Validate email format before hitting the network.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Generic user-facing messages — never expose internal Supabase errors.
function friendlyError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid credentials') || lower.includes('email not confirmed')) {
    return 'E-mail ou senha inválidos.';
  }
  if (lower.includes('too many') || lower.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns instantes.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Erro de conexão. Verifique sua internet.';
  }
  return 'Ocorreu um erro. Tente novamente.';
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Rate limiting state
  const attemptsRef = useRef(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startLockout() {
    const until = Date.now() + LOCKOUT_SECONDS * 1000;
    setLockedUntil(until);
    setLockCountdown(LOCKOUT_SECONDS);
    countdownRef.current = setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        setLockedUntil(null);
        setLockCountdown(0);
        attemptsRef.current = 0;
        setError(null);
      } else {
        setLockCountdown(remaining);
      }
    }, 1000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Check lockout
    if (lockedUntil && Date.now() < lockedUntil) {
      setError(`Muitas tentativas. Aguarde ${lockCountdown}s.`);
      return;
    }

    const cleanEmail = sanitizeEmail(email);
    const cleanPassword = password.slice(0, MAX_PASSWORD_LENGTH);

    // Client-side format validation
    if (!EMAIL_RE.test(cleanEmail)) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (cleanPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });
    setIsLoading(false);

    if (authError) {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        startLockout();
        setError(`Conta bloqueada temporariamente. Tente em ${LOCKOUT_SECONDS}s.`);
      } else {
        setError(friendlyError(authError.message));
      }
    }
    // On success, AuthContext handles redirect via onAuthStateChange
  }

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[32rem] w-[32rem] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-48 rounded-full bg-primary/12 blur-[60px]" />
      </div>

      <div className="relative w-full max-w-sm px-4 sm:px-0 animate-slide-up">
        {/* Logo */}
        <div className="mb-10 text-center space-y-2">
          <h1 className="font-mono text-5xl font-bold text-primary text-glow tracking-tighter select-none">
            ello
          </h1>
          <p className="text-[11px] text-muted-foreground tracking-[0.2em] uppercase font-medium">
            Comissão sobre Notas Liquidadas
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border/60 rounded-xl p-6 sm:p-8 space-y-6 shadow-2xl">

          {/* Status badge */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/50 rounded-full px-3 py-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono">Sistema Online</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* E-mail */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-[11px] text-muted-foreground tracking-[0.15em] uppercase font-semibold"
              >
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                maxLength={254}
                placeholder="usuario@empresa.com"
                disabled={isLocked || isLoading}
                className="bg-secondary/60 border-border/60 placeholder:text-muted-foreground/40
                           focus:border-primary focus:ring-1 focus:ring-primary/30
                           transition-all duration-200 font-mono text-sm"
              />
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-[11px] text-muted-foreground tracking-[0.15em] uppercase font-semibold"
              >
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  maxLength={MAX_PASSWORD_LENGTH}
                  placeholder="••••••••"
                  disabled={isLocked || isLoading}
                  className="bg-secondary/60 border-border/60 placeholder:text-muted-foreground/40
                             focus:border-primary focus:ring-1 focus:ring-primary/30
                             transition-all duration-200 font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  disabled={isLocked || isLoading}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground
                             hover:text-primary transition-colors duration-150 focus:outline-none
                             focus-visible:ring-1 focus-visible:ring-primary/60 rounded"
                >
                  {showPassword
                    ? <EyeOff size={15} strokeWidth={1.8} />
                    : <Eye size={15} strokeWidth={1.8} />
                  }
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 text-xs text-destructive border border-destructive/25
                           bg-destructive/8 rounded-lg px-3 py-2.5 animate-fade-in"
              >
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                {isLocked
                  ? <span>Acesso bloqueado. Aguarde <span className="font-mono font-bold">{lockCountdown}s</span>.</span>
                  : error
                }
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading || isLocked}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90
                         font-semibold glow-primary transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  <span className="font-mono text-sm">Autenticando…</span>
                </span>
              ) : isLocked ? (
                <span className="font-mono text-sm">{lockCountdown}s</span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn size={15} strokeWidth={2} />
                  <span className="font-mono text-sm">Entrar</span>
                </span>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-muted-foreground/40 font-mono tracking-wide">
          acesso restrito · uso interno
        </p>
      </div>
    </div>
  );
}
