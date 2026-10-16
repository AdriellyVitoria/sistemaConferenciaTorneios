/**
 * Salvar um arquivo que veio pelo fetch (R3). O "Baixar CSV" não pode ser um link comum: o
 * navegador não põe o cabeçalho Authorization num link. A tela baixa com o fetch e entrega o
 * arquivo ao navegador por um endereço temporário (blob:).
 */

/**
 * O nome do arquivo no Content-Disposition (6c): o `filename*` (com acentos, RFC 6266) e, se
 * não houver ou estiver mal escrito, o `filename`. Nome com barra ou ".." vira o padrão.
 */
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

/** Entrega o arquivo ao navegador, como um download comum. */
export function salvarArquivo(conteudo: Blob, nome: string) {
  const endereco = URL.createObjectURL(conteudo);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  // libera depois: alguns navegadores ainda leem o endereço logo após o clique
  setTimeout(() => URL.revokeObjectURL(endereco), 0);
}
