export function nomeDoArquivoBaixado(disposicao: string | null, padrao: string): string {
  const nome = comAcentos(disposicao) ?? /filename="([^"]+)"/i.exec(disposicao ?? '')?.[1];
  if (!nome || /[/\\]|\.\./.test(nome)) return padrao;
  return nome;
}

function comAcentos(disposicao: string | null): string | undefined {
  const codificado = /filename\*=UTF-8''([^;]+)/i.exec(disposicao ?? '')?.[1];
  if (!codificado) return undefined;
  try {
    return decodeURIComponent(codificado);
  } catch {
    return undefined;
  }
}

export function salvarArquivo(conteudo: Blob, nome: string) {
  const endereco = URL.createObjectURL(conteudo);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(endereco), 0);
}
