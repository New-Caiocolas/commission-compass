import React, { createContext, useContext, useState, ReactNode } from 'react';

const ANO_ATUAL = new Date().getFullYear();

interface FiltrosState {
  anos: number[];
  meses: number[];
  setAnos: (anos: number[]) => void;
  setMeses: (meses: number[]) => void;
}

const FiltrosContext = createContext<FiltrosState | undefined>(undefined);

export function FiltrosProvider({ children }: { children: ReactNode }) {
  // Inicia com ano atual E ano anterior já selecionados
  const [anos, setAnos] = useState<number[]>([ANO_ATUAL - 1, ANO_ATUAL]);
  const [meses, setMeses] = useState<number[]>([]);

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
