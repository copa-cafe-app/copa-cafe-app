import { supabase } from '../services/supabase';

function mediaTypeFromUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

// Sobe a imagem do comprovante para o bucket `comprovantes` e devolve a URL
// pública. Usado tanto em Nova Despesa quanto no Diário de Campo.
export async function uploadComprovante(imageUri: string, userId: string): Promise<string> {
  const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${userId}/${Date.now()}.${ext}`;

  const response = await fetch(imageUri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const { error } = await supabase.storage
    .from('comprovantes')
    .upload(fileName, arrayBuffer, {
      contentType: mediaTypeFromUri(imageUri),
      upsert: false,
    });

  if (error) throw new Error(`Erro no upload: ${error.message}`);

  const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(fileName);
  return urlData.publicUrl;
}
