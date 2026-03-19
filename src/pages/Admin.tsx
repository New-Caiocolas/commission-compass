import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp, Camera, X } from 'lucide-react';

interface Profile {
  id: string;
  nome: string;
  cargo: string;
  repres_vend: number | null;
  vendedores_ids: number[] | null;
  foto_url: string | null;
}

interface Vendedor {
  repres_vend: number;
  nome_rep: string;
}

function useVendedoresDisponiveis() {
  return useQuery({
    queryKey: ['vendedores-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_representantes' as never);
      if (error) {
        // fallback se a função não existir
        const { data: d2, error: e2 } = await supabase
          .from('comissoes')
          .select('repres_vend, nome_rep')
          .not('repres_vend', 'is', null)
          .not('nome_rep', 'is', null)
          .limit(99999);
        if (e2) throw e2;
        const map = new Map<number, string>();
        (d2 || []).forEach((r: any) => {
          if (r.repres_vend && r.nome_rep) map.set(Number(r.repres_vend), r.nome_rep);
        });
        return Array.from(map.entries())
          .map(([repres_vend, nome_rep]) => ({ repres_vend, nome_rep }))
          .filter(v => !['FUNCIONARIO', 'Padrão Empresa'].includes(v.nome_rep))
          .sort((a, b) => a.nome_rep.localeCompare(b.nome_rep));
      }
      return (data || []) as Vendedor[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

function VendedoresSeletor({ value, onChange, vendedores }: {
  value: number[];
  onChange: (ids: number[]) => void;
  vendedores: Vendedor[];
}) {
  const [open, setOpen] = useState(false);
  const toggleVendedor = (id: number) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };
  const selecionados = vendedores.filter(v => value.includes(v.repres_vend));

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full h-8 text-sm bg-background border border-input rounded px-2 flex items-center justify-between hover:bg-secondary/50 transition-colors">
        <span className="truncate text-left text-sm">
          {selecionados.length === 0 ? 'Selecionar vendedores...' : `${selecionados.length} selecionado${selecionados.length > 1 ? 's' : ''}`}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {vendedores.map(v => (
            <button key={v.repres_vend} type="button" onClick={() => toggleVendedor(v.repres_vend)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50 transition-colors text-left">
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${value.includes(v.repres_vend) ? 'bg-primary border-primary' : 'border-border'}`}>
                {value.includes(v.repres_vend) && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <span className="flex-1 truncate">{v.nome_rep}</span>
              <span className="text-xs text-muted-foreground font-mono">#{v.repres_vend}</span>
            </button>
          ))}
          {vendedores.length === 0 && <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum vendedor encontrado</p>}
        </div>
      )}
    </div>
  );
}

// ── Upload de foto ────────────────────────────────────────────────────────────
function FotoUpload({ profileId, fotoUrl, onUploaded }: {
  profileId: string;
  fotoUrl: string | null;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `perfil_${profileId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('vendedores-fotos')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from('vendedores-fotos')
        .getPublicUrl(path);

      const { error: updateErr } = await supabase
        .from('profiles' as never)
        .update({ foto_url: urlData.publicUrl } as never)
        .eq('id', profileId);
      if (updateErr) throw updateErr;

      onUploaded(urlData.publicUrl);
      toast({ title: 'Foto atualizada com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    const { error } = await supabase
      .from('profiles' as never)
      .update({ foto_url: null } as never)
      .eq('id', profileId);
    if (!error) onUploaded('');
  };

  return (
    <div className="flex items-center gap-2">
      {/* Preview */}
      <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0">
        {fotoUrl ? (
          <img src={fotoUrl} alt="foto" className="w-full h-full object-cover" />
        ) : (
          <Camera className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
      >
        {uploading ? 'Enviando...' : fotoUrl ? 'Trocar foto' : 'Adicionar foto'}
      </button>

      {fotoUrl && (
        <button type="button" onClick={handleRemove} className="text-muted-foreground hover:text-destructive transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Admin() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Profile>>({});
  const { data: vendedores = [] } = useVendedoresDisponiveis();

  async function fetchProfiles() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('profiles' as never)
      .select('id, nome, cargo, repres_vend, vendedores_ids, foto_url')
      .order('nome');
    if (!error && data) setProfiles(data as unknown as Profile[]);
    setIsLoading(false);
  }

  useEffect(() => { fetchProfiles(); }, []);

  function startEdit(p: Profile) {
    setEditingId(p.id);
    setEditData({ nome: p.nome, cargo: p.cargo, repres_vend: p.repres_vend, vendedores_ids: p.vendedores_ids ?? [], foto_url: p.foto_url });
  }

  async function saveEdit(id: string) {
    const { foto_url, ...dataToSave } = editData;
    const { error } = await supabase
      .from('profiles' as never)
      .update(dataToSave as never)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Salvo com sucesso' });
      setEditingId(null);
      fetchProfiles();
    }
  }

  const getNomesVendedores = (ids: number[] | null) => {
    if (!ids?.length) return '—';
    return ids.map(id => {
      const v = vendedores.find(v => v.repres_vend === id);
      return v ? v.nome_rep : `#${id}`;
    }).join(', ');
  };

  const CARGO_OPTIONS = ['administrador', 'supervisor', 'vendedor'];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Gerenciar Usuários</h1>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-card border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Foto</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Nome</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Cargo</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Repres. Vend.</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Equipe</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {profiles.map((p, i) => (
                  <tr key={p.id} className={`border-b ${i % 2 === 1 ? 'bg-table-row-alt' : ''}`}>
                    {editingId === p.id ? (
                      <>
                        <td className="px-4 py-2">
                          <FotoUpload
                            profileId={p.id}
                            fotoUrl={editData.foto_url ?? null}
                            onUploaded={url => setEditData(d => ({ ...d, foto_url: url || null }))}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input value={editData.nome ?? ''} onChange={e => setEditData(d => ({ ...d, nome: e.target.value }))} className="h-7 text-sm" />
                        </td>
                        <td className="px-4 py-2">
                          <select value={editData.cargo ?? ''} onChange={e => setEditData(d => ({ ...d, cargo: e.target.value }))}
                            className="h-7 text-sm bg-background border border-input rounded px-2">
                            {CARGO_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <Input type="number" value={editData.repres_vend ?? ''}
                            onChange={e => setEditData(d => ({ ...d, repres_vend: e.target.value ? Number(e.target.value) : null }))}
                            className="h-7 text-sm w-24" />
                        </td>
                        <td className="px-4 py-2 min-w-[220px]">
                          <VendedoresSeletor
                            value={editData.vendedores_ids ?? []}
                            onChange={ids => setEditData(d => ({ ...d, vendedores_ids: ids }))}
                            vendedores={vendedores}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit(p.id)}>Salvar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center">
                            {p.foto_url
                              ? <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                              : <span className="text-xs font-bold text-muted-foreground">{p.nome[0]}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2 font-medium">{p.nome}</td>
                        <td className="px-4 py-2 capitalize">{p.cargo}</td>
                        <td className="px-4 py-2">{p.repres_vend ?? '—'}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground max-w-[260px] truncate">
                          {getNomesVendedores(p.vendedores_ids)}
                        </td>
                        <td className="px-4 py-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Editar</Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {profiles.map(p => (
              <div key={p.id} className="bg-card border rounded-lg p-4 space-y-3">
                {editingId === p.id ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Foto</Label>
                      <FotoUpload
                        profileId={p.id}
                        fotoUrl={editData.foto_url ?? null}
                        onUploaded={url => setEditData(d => ({ ...d, foto_url: url || null }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input value={editData.nome ?? ''} onChange={e => setEditData(d => ({ ...d, nome: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cargo</Label>
                      <select value={editData.cargo ?? ''} onChange={e => setEditData(d => ({ ...d, cargo: e.target.value }))}
                        className="h-8 w-full text-sm bg-background border border-input rounded px-2">
                        {CARGO_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Repres. Vend.</Label>
                      <Input type="number" value={editData.repres_vend ?? ''}
                        onChange={e => setEditData(d => ({ ...d, repres_vend: e.target.value ? Number(e.target.value) : null }))}
                        className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Equipe</Label>
                      <VendedoresSeletor
                        value={editData.vendedores_ids ?? []}
                        onChange={ids => setEditData(d => ({ ...d, vendedores_ids: ids }))}
                        vendedores={vendedores}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(p.id)}>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0">
                        {p.foto_url
                          ? <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                          : <span className="text-sm font-bold text-muted-foreground">{p.nome[0]}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.nome}</p>
                        <span className="text-xs capitalize text-muted-foreground">{p.cargo}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Rep: {p.repres_vend ?? '—'}</p>
                      <p className="truncate">Equipe: {getNomesVendedores(p.vendedores_ids)}</p>
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => startEdit(p)}>Editar</Button>
                  </>
                )}
              </div>
            ))}
            {profiles.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhum usuário encontrado</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
