import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FiltrosState {
  anos: number[];
  meses: number[];
  setAnos: (anos: number[]) => void;
  setMeses: (meses: number[]) => void;
}

const FiltrosContext = createContext<FiltrosState | undefined>(undefined);

export function FiltrosProvider({ children }: { children: ReactNode }) {
  const currentYear = new Date().getFullYear();
  const [anos, setAnos] = useState<number[]>([]);
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
