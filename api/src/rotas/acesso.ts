/**
 * Senha única da organizadora (R3, item 1 do code review). Não é login: não há usuário, cadastro
 * nem recuperação. A senha fica no ADMIN_SENHA do .env; trocar = editar o .env e reiniciar a API.
 *
 * Toda requisição que chega aqui precisa de "Authorization: Bearer <senha>". As rotas abertas
 * (/saude, /publico/*, /time/*) são montadas ANTES deste middleware, em app.ts: elas respondem e a
 * requisição não chega aqui. Qualquer outra, inclusive uma rota que não existe, dá 401.
 *
 *   GET /acesso   204 com a senha certa: a tela confere a senha digitada sem buscar dados.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';

const SEM_ACESSO = { erro: 'Acesso só da organizadora.' };

/**
 * Compara pelo resumo SHA-256 das duas senhas: os resumos têm sempre 32 bytes, então o
 * `timingSafeEqual` (que exige o mesmo tamanho) compara sem contar, pelo tempo, quantos caracteres
 * acertou nem qual é o tamanho da senha.
 */
const resumo = (texto: string) => createHash('sha256').update(texto, 'utf8').digest();

export function exigirSenhaDaOrganizadora(senha: string) {
  const esperado = resumo(senha);
  return (req: Request, res: Response, proximo: NextFunction) => {
    // "Bearer" sem diferenciar maiúsculas (RFC 7235); a senha, exatamente como veio
    const recebida = /^Bearer (.+)$/i.exec(req.get('authorization') ?? '')?.[1];
    if (recebida !== undefined && timingSafeEqual(resumo(recebida), esperado)) {
      proximo();
      return;
    }
    res.status(401).set('WWW-Authenticate', 'Bearer').json(SEM_ACESSO);
  };
}

export function rotaAcesso(): Router {
  const rota = Router();
  rota.get('/acesso', (_req, res) => {
    res.status(204).end();
  });
  return rota;
}
