/**
 * O espaço que não quebra (U+00A0), escrito com o código do caractere: o próprio caractere é
 * invisível no código, igual ao espaço comum, e ninguém saberia qual dos dois está ali.
 */
export const ESPACO_QUE_NAO_QUEBRA = String.fromCharCode(0x00a0);

/**
 * Troca o espaço que não quebra por espaço comum. Os testes comparam os valores como se leem
 * ("R$ 1.000,00"), sem espalhar o caractere invisível por eles (R2b).
 */
export function espacosComuns(texto: string): string {
  return texto.split(ESPACO_QUE_NAO_QUEBRA).join(' ');
}

/**
 * O mesmo valor, com os textos de dentro (em listas e objetos, em qualquer nível) com espaços
 * comuns. Para os testes das funções que montam frases e tabelas com valores em reais.
 */
export function comEspacosComuns<T>(valor: T): T {
  if (typeof valor === 'string') return espacosComuns(valor) as T;
  if (Array.isArray(valor)) return valor.map(comEspacosComuns) as T;
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([chave, v]) => [chave, comEspacosComuns(v)])) as T;
  }
  return valor;
}

/** O texto de um elemento da tela, como se lê: os testes de componente leem a tela sempre por aqui. */
export function textoDe(elemento: { text(): string }): string {
  return espacosComuns(elemento.text());
}
