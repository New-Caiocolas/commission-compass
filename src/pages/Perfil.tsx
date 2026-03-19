import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Camera, User, Mail, Shield, Key, Save } from 'lucide-react';

export default function Perfil() {
  const { profile, session } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(profile?.nome ?? '');
  const [fotoUrl, setFotoUrl] = useState(profile?.foto_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [savingNome, setSavingNome] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirm, setSenhaConfirm] = useState('');
  const [savingSenha, setSavingSenha] = useState(false);

  const initiais = (profile?.nome ?? 'U').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const CARGO_LABEL: Record<string, string> = {
    administrador: 'Administrador',
    supervisor: 'Supervisor',
    vendedor: 'Vendedor',
  };

  // ── Upload de foto ──────────────────────────────────────────────────────────
  const handleUploadFoto = async (file: File) => {
    if (!profile?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `perfil_${profile.id}.${ext}`;
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
        .eq('id', profile.id);
      if (updateErr) throw updateErr;

      setFotoUrl(urlData.publicUrl);
      toast({ title: 'Foto atualizada com sucesso!' });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // ── Salvar nome ─────────────────────────────────────────────────────────────
  const handleSalvarNome = async () => {
    if (!profile?.id || !nome.trim()) return;
    setSavingNome(true);
    try {
      const { error } = await supabase
        .from('profiles' as never)
        .update({ nome: nome.trim() } as never)
        .eq('id', profile.id);
      if (error) throw error;
      toast({ title: 'Nome atualizado com sucesso!' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSavingNome(false);
    }
  };

  // ── Alterar senha ───────────────────────────────────────────────────────────
  const handleAlterarSenha = async () => {
    if (!senhaNova || !senhaConfirm) return;
    if (senhaNova !== senhaConfirm) {
      toast({ title: 'Senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (senhaNova.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setSavingSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senhaNova });
      if (error) throw error;
      toast({ title: 'Senha alterada com sucesso!' });
      setSenhaAtual('');
      setSenhaNova('');
      setSenhaConfirm('');
    } catch (err: any) {
      toast({ title: 'Erro ao alterar senha', description: err.message, variant: 'destructive' });
    } finally {
      setSavingSenha(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">Meu Perfil</h1>

      {/* ── Foto ── */}
      <div className="bg-card border border-border/60 rounded-xl p-6 flex flex-col items-center gap-4">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30 bg-secondary flex items-center justify-center shadow-lg">
            {fotoUrl ? (
              <img src={fotoUrl} alt={profile?.nome} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{initiais}</span>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors shadow-md"
          >
            <Camera className="h-4 w-4 text-primary-foreground" />
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleUploadFoto(e.target.files[0])} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-lg">{profile?.nome}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{session?.user?.email}</p>
        </div>
      </div>

      {/* ── Informações ── */}
      <div className="bg-card border border-border/60 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Informações
        </h2>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome / Apelido</Label>
          <div className="flex gap-2">
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Seu nome ou apelido"
              className="flex-1"
            />
            <Button size="sm" onClick={handleSalvarNome} disabled={savingNome || !nome.trim()}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {savingNome ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email
          </Label>
          <Input value={session?.user?.email ?? ''} disabled className="text-muted-foreground" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Cargo
          </Label>
          <Input value={CARGO_LABEL[profile?.cargo ?? ''] ?? profile?.cargo ?? ''} disabled className="text-muted-foreground capitalize" />
        </div>
      </div>

      {/* ── Alterar senha ── */}
      <div className="bg-card border border-border/60 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" />
          Alterar Senha
        </h2>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nova senha</Label>
            <Input
              type="password"
              value={senhaNova}
              onChange={e => setSenhaNova(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
            <Input
              type="password"
              value={senhaConfirm}
              onChange={e => setSenhaConfirm(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>
          {senhaNova && senhaConfirm && senhaNova !== senhaConfirm && (
            <p className="text-xs text-destructive">As senhas não coincidem</p>
          )}
        </div>

        <Button
          onClick={handleAlterarSenha}
          disabled={savingSenha || !senhaNova || !senhaConfirm || senhaNova !== senhaConfirm}
          className="w-full"
        >
          {savingSenha ? 'Alterando...' : 'Alterar Senha'}
        </Button>
      </div>
    </div>
  );
}
