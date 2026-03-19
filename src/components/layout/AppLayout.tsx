import { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-3 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
