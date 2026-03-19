import React, { createContext, useContext, useState, ReactNode } from 'react';

const ANO_ATUAL = new Date().getFullYear();
const TODOS_MESES = Array.from({ length: 12 }, (_, i) => i + 1);

interface FiltrosState {
  anos: number[];
  meses: number[];
  setAnos: (anos: number[]) => void;
  setMeses: (meses: number[]) => void;
}

const FiltrosContext = createContext<FiltrosState | undefined>(undefined);

export function FiltrosProvider({ children }: { children: ReactNode }) {
  const [anos, setAnos] = useState<number[]>([ANO_ATUAL]);
  const [meses, setMeses] = useState<number[]>(TODOS_MESES);

  return (
    <FiltrosContext.Provider value={{ anos, meses, setAnos, setMeses }}>
      {children}
    </FiltrosContext.Provider>
  );
}

export function useFiltros() {
  const ctx = useContext(FiltrosContext);
  if (!ctx) throw new Error('useFiltros must be used within FiltrosProvider');
  return ctx;
}
