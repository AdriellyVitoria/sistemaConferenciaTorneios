import { randomBytes } from 'node:crypto';

const BYTES = 24;

export const FORMATO_DO_CODIGO = /^[A-Za-z0-9_-]{32}$/;

export function gerarCodigoDeAcesso(aleatorio: (tamanho: number) => Buffer = randomBytes): string {
  return aleatorio(BYTES).toString('base64url');
}
