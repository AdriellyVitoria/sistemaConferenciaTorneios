/**
 * Códigos de acesso dos links (D11): o da página pública do torneio e o de cada time premiado.
 *
 * Não há login: quem tem o link vê. Por isso o código precisa ser impossível de adivinhar:
 * 24 bytes do gerador criptográfico do sistema (192 bits), em base64url, que dá exatamente
 * 32 caracteres seguros para URL (letras, números, "-" e "_"), sem precisar de escape.
 * Um id sequencial ou Math.random deixaria qualquer um tentar o próximo número.
 */

import { randomBytes } from 'node:crypto';

const BYTES = 24;

/** O formato de um código gerado: a rota recusa o resto sem nem consultar o banco. */
export const FORMATO_DO_CODIGO = /^[A-Za-z0-9_-]{32}$/;

/** `aleatorio` só existe para o teste; o padrão é o gerador criptográfico do Node. */
export function gerarCodigoDeAcesso(aleatorio: (tamanho: number) => Buffer = randomBytes): string {
  return aleatorio(BYTES).toString('base64url');
}
