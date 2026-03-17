import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  nome: string;
  cargo: string;
  repres_vend: number | null;
  vendedores_ids: number[] | null;
}

export default function Admin() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Profile>>({});

  async function fetchProfiles() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('profiles' as never)
      .select('id, nome, cargo, repres_vend, vendedores_ids')
      .order('nome');
    if (!error && data) setProfiles(data as unknown as Profile[]);
    setIsLoading(false);
  }

  useEffect(() => { fetchProfiles(); }, []);

  function startEdit(p: Profile) {
    setEditingId(p.id);
    setEditData({ nome: p.nome, cargo: p.cargo, repres_vend: p.repres_vend, vendedores_ids: p.vendedores_ids });
  }

  async function saveEdit(id: string) {
    const { error } = await supabase
      .from('profiles' as never)
      .update(editData as never)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Salvo com sucesso' });
      setEditingId(null);
      fetchProfiles();
    }
  }

  const CARGO_OPTIONS = ['administrador', 'supervisor', 'vendedor'];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Gerenciar Usuários</h1>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Nome</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Cargo</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Repres. Vend.</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-semibold">IDs Vendedores</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, i) => (
                <tr key={p.id} className={`border-b ${i % 2 === 1 ? 'bg-table-row-alt' : ''}`}>
                  {editingId === p.id ? (
                    <>
                      <td className="px-4 py-2">
                        <Input
                          value={editData.nome ?? ''}
                          onChange={e => setEditData(d => ({ ...d, nome: e.target.value }))}
                          className="h-7 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editData.cargo ?? ''}
                          onChange={e => setEditData(d => ({ ...d, cargo: e.target.value }))}
                          className="h-7 text-sm bg-background border border-input rounded px-2"
                        >
                          {CARGO_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={editData.repres_vend ?? ''}
                          onChange={e => setEditData(d => ({ ...d, repres_vend: e.target.value ? Number(e.target.value) : null }))}
                          className="h-7 text-sm w-24"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={editData.vendedores_ids?.join(',') ?? ''}
                          onChange={e => setEditData(d => ({
                            ...d,
                            vendedores_ids: e.target.value ? e.target.value.split(',').map(Number).filter(Boolean) : null,
                          }))}
                          placeholder="1,2,3"
                          className="h-7 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(p.id)}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2">{p.nome}</td>
                      <td className="px-4 py-2 capitalize">{p.cargo}</td>
                      <td className="px-4 py-2">{p.repres_vend ?? '—'}</td>
                      <td className="px-4 py-2">{p.vendedores_ids?.join(', ') ?? '—'}</td>
                      <td className="px-4 py-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Editar</Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
