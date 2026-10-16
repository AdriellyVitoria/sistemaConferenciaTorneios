let aviso: string | null = null;

export function deixarAvisoParaALista(texto: string): void {
  aviso = texto;
}

export function pegarAvisoDaLista(): string | null {
  const texto = aviso;
  aviso = null;
  return texto;
}
