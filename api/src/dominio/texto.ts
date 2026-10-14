/**
 * Forma de comparar nomes digitados à mão: sem acentos, sem maiúsculas e sem espaços extras.
 * "xxsniperxx" e "xXSniperXx" ficam iguais; "Falcoes" e "Falcões" também.
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // remove os acentos que o NFD separou das letras
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ordem alfabética de dicionário: ignora acentos e maiúsculas ("Águias" vem antes de "Ursos").
 * Em caso de empate, decide pelo texto original, para a ordem ser sempre a mesma.
 */
export function compararAlfabetico(a: string, b: string): number {
  const [na, nb] = [normalizarNome(a), normalizarNome(b)];
  if (na !== nb) return na < nb ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Junta nomes como numa frase: "A", "A e B", "A, B e C". */
export function juntarComE(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
