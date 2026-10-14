// Chamadas à API. Todas passam pelo prefixo /api, que o Vite repassa para o servidor.

export interface Saude {
  api: 'ok';
  banco: 'ok' | 'erro';
}

export async function buscarSaude(): Promise<Saude> {
  const resposta = await fetch('/api/saude');
  // 503 também traz o corpo com o estado do banco
  if (!resposta.ok && resposta.status !== 503) {
    throw new Error(`API respondeu ${resposta.status}`);
  }
  return resposta.json();
}
