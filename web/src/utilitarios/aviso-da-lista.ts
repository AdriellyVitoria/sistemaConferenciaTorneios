/**
 * Um aviso que uma tela deixa para a lista de torneios mostrar quando a Maria chega nela (M2):
 * depois de remover o torneio na página dele, a tela volta para a lista com "Torneio removido."
 * Vale uma vez só: a lista pega e apaga.
 */

let aviso: string | null = null;

export function deixarAvisoParaALista(texto: string): void {
  aviso = texto;
}

export function pegarAvisoDaLista(): string | null {
  const texto = aviso;
  aviso = null;
  return texto;
}
