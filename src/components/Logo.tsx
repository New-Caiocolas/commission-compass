/**
 * Logo Ello Atacadao — SVG inline para funcionar em ambos os temas (dark/light).
 * Baseado na identidade visual oficial.
 */

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showSubtitle = false, className = '' }: LogoProps) {
  const sizes = {
    sm: { width: 80, height: 32 },
    md: { width: 120, height: 48 },
    lg: { width: 200, height: 80 },
  };

  const { width, height } = sizes[size];

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox="0 0 260 85"
        width={width}
        height={height}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Ello Atacadao"
      >
        {/* Elipse azul principal */}
        <ellipse
          cx="42"
          cy="40"
          rx="40"
          ry="34"
          transform="rotate(-12 42 40)"
          fill="#0091D5"
        />

        {/* Corte interno — cria efeito de crescente/swoosh */}
        <ellipse
          cx="48"
          cy="38"
          rx="30"
          ry="24"
          transform="rotate(-12 48 38)"
          fill="hsl(var(--background))"
        />

        {/* Elipse verde interna */}
        <ellipse
          cx="44"
          cy="46"
          rx="11"
          ry="7"
          transform="rotate(-8 44 46)"
          fill="#8BC53F"
        />

        {/* Texto "ello" — usa cor adaptativa ao tema */}
        <text
          x="92"
          y="52"
          fontFamily="'Syne', system-ui, sans-serif"
          fontSize="48"
          fontWeight="700"
          fill="hsl(var(--foreground))"
          opacity="0.75"
        >
          ello
        </text>

        {/* Texto "atacadao" */}
        <text
          x="94"
          y="74"
          fontFamily="'Syne', system-ui, sans-serif"
          fontSize="21"
          fontWeight="500"
          letterSpacing="1.5"
          fill="hsl(var(--muted-foreground))"
        >
          atacad&#xe3;o
        </text>
      </svg>

      {showSubtitle && (
        <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase font-medium mt-1">
          Comissao sobre Notas Liquidadas
        </p>
      )}
    </div>
  );
}

/** Versao compacta — apenas o icone grafico (sem texto) */
export function LogoIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 84 80"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ello"
      className={className}
    >
      <ellipse
        cx="42"
        cy="40"
        rx="40"
        ry="34"
        transform="rotate(-12 42 40)"
        fill="#0091D5"
      />
      <ellipse
        cx="48"
        cy="38"
        rx="30"
        ry="24"
        transform="rotate(-12 48 38)"
        fill="hsl(var(--background))"
      />
      <ellipse
        cx="44"
        cy="46"
        rx="11"
        ry="7"
        transform="rotate(-8 44 46)"
        fill="#8BC53F"
      />
    </svg>
  );
}
