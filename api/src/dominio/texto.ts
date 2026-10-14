/**
 * Forma de comparar nomes digitados à mão: sem acentos, sem maiúsculas e sem espaços extras.
 * "xxsniperxx" e "xXSniperXx" ficam iguais; "Falcoes" e "Falcões" também.
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Junta nomes como numa frase: "A", "A e B", "A, B e C". */
export function juntarComE(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
