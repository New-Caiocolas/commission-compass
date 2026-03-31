import { supabase } from '@/integrations/supabase/client';

// Tipos MIME aceitos → extensão canônica derivada do tipo real (não do nome do arquivo)
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_MIME[file.type]) {
    return 'Formato inválido. Use JPG, PNG, GIF ou WebP.';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'Imagem muito grande. Máximo 5 MB.';
  }
  return null;
}

type UploadResult =
  | { publicUrl: string; error?: undefined }
  | { publicUrl?: undefined; error: string };

/**
 * Valida, sanitiza e faz upload de uma foto de perfil para o bucket vendedores-fotos.
 * @param file   Arquivo selecionado pelo usuário
 * @param basePath  Caminho base sem extensão, ex: "perfil_<uuid>" ou "<represVend>"
 */
export async function uploadFotoPerfil(file: File, basePath: string): Promise<UploadResult> {
  const validationError = validateImageFile(file);
  if (validationError) return { error: validationError };

  // Extensão vem do MIME type verificado, nunca do nome do arquivo
  const ext = ALLOWED_MIME[file.type];
  const path = `${basePath}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('vendedores-fotos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (upErr) return { error: upErr.message };

  const { data: urlData } = supabase.storage
    .from('vendedores-fotos')
    .getPublicUrl(path);

  return { publicUrl: urlData.publicUrl };
}
