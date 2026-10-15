/**
 * Collation das colunas de texto digitadas à mão (nick, time, ID da partida): compara o texto
 * exatamente como veio, diferenciando acentos e maiúsculas.
 *
 * O padrão do MySQL 8 (utf8mb4_0900_ai_ci) trataria "xxsniperxx" e "xXSniperXx", ou "Falcoes" e
 * "Falcões", como o mesmo texto. Quem decide se são o mesmo jogador ou time é o domínio, com aviso
 * e "Ciente" (D7, D19); o banco não pode juntar em silêncio num GROUP BY ou numa chave única.
 */
export const TEXTO_EXATO = 'utf8mb4_0900_as_cs';
