export const ESPACO_QUE_NAO_QUEBRA = String.fromCharCode(0x00a0);

export function espacosComuns(texto: string): string {
  return texto.split(ESPACO_QUE_NAO_QUEBRA).join(' ');
}

export function comEspacosComuns<T>(valor: T): T {
  if (typeof valor === 'string') return espacosComuns(valor) as T;
  if (Array.isArray(valor)) return valor.map(comEspacosComuns) as T;
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([chave, v]) => [chave, comEspacosComuns(v)])) as T;
  }
  return valor;
}

export function textoDe(elemento: { text(): string }): string {
  return espacosComuns(elemento.text());
}
