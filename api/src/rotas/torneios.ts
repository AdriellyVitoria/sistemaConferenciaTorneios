/**
 * Rotas do torneio (etapa 3b). Só recebem a requisição, validam a entrada e devolvem a resposta;
 * as regras ficam no serviço e no domínio.
 *
 *   GET  /torneios                  os torneios, o mais novo primeiro, com quantas partidas cada um tem
 *   POST /torneios                  cria o torneio
 *   GET  /torneios/:id              o torneio, com as partidas e o status de cada uma
 *   PUT  /torneios/:id/planilha     envia (ou reenvia) a planilha: o arquivo vai direto no corpo,
 *                                   e o nome no cabeçalho X-Nome-Arquivo (codificado com encodeURIComponent)
 */

import express, { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { assincrono } from './assincrono';
import { consultarTorneio, criarTorneio, importarPlanilha, listarTorneios } from '../servicos/torneios';

const TAMANHO_MAXIMO = '5mb'; // a planilha de setembro tem 9 KB

const esquemaTorneio = z.object({
  nome: z.string({ required_error: 'Informe o nome do torneio.' }).trim().min(1, 'Informe o nome do torneio.').max(120, 'O nome pode ter até 120 letras.'),
  premioCentavos: z
    .number({ required_error: 'Informe o prêmio.', invalid_type_error: 'O prêmio precisa ser um número de centavos.' })
    .int('O prêmio precisa ser um número inteiro de centavos (R$ 10.000,00 = 1000000).')
    .nonnegative('O prêmio não pode ser negativo.')
    .max(4_294_967_295, 'O prêmio é grande demais.'),
  percentuais: z.array(z.number(), {
    required_error: 'Informe os percentuais por posição.',
    invalid_type_error: 'Os percentuais precisam ser uma lista de números, como [50, 30, 20].',
  }),
  modoDivisao: z.enum(['minutos', 'kills'], {
    errorMap: () => ({ message: 'A forma de divisão precisa ser "minutos" ou "kills".' }),
  }),
});

const esquemaId = z.coerce.number().int().positive();

export function rotasTorneios(bd: Knex): Router {
  const rota = Router();

  rota.post('/torneios', assincrono(async (req, res) => {
    const entrada = esquemaTorneio.safeParse(req.body);
    if (!entrada.success) {
      res.status(400).json({
        erros: entrada.error.issues.map((i) => ({ campo: String(i.path[0] ?? ''), mensagem: i.message })),
      });
      return;
    }
    const resultado = await criarTorneio(bd, entrada.data);
    if (!resultado.ok) {
      res.status(400).json({ erros: resultado.erros });
      return;
    }
    res.status(201).json({ id: resultado.id });
  }));

  rota.get('/torneios', assincrono(async (_req, res) => {
    res.json(await listarTorneios(bd));
  }));

  rota.get('/torneios/:id', assincrono(async (req, res) => {
    const id = esquemaId.safeParse(req.params.id);
    const torneio = id.success ? await consultarTorneio(bd, id.data) : null;
    if (!torneio) {
      res.status(404).json({ erro: 'Torneio não encontrado.' });
      return;
    }
    res.json(torneio);
  }));

  rota.put(
    '/torneios/:id/planilha',
    // aceita o arquivo como veio, em bytes: a leitura descobre a codificação (D18)
    express.raw({ type: () => true, limit: TAMANHO_MAXIMO }),
    assincrono(async (req, res) => {
      const id = esquemaId.safeParse(req.params.id);
      if (!id.success) {
        res.status(404).json({ erro: 'Torneio não encontrado.' });
        return;
      }
      const conteudo: Uint8Array = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const resultado = await importarPlanilha(bd, id.data, conteudo, nomeDoArquivo(req.get('x-nome-arquivo')));

      switch (resultado.tipo) {
        case 'importada': {
          const { tipo: _tipo, ...resposta } = resultado;
          res.json(resposta);
          return;
        }
        case 'invalida':
          res.status(400).json({ erros: resultado.erros, convertidoDeWindows1252: resultado.convertidoDeWindows1252 });
          return;
        case 'torneio_nao_encontrado':
          res.status(404).json({ erro: 'Torneio não encontrado.' });
          return;
        case 'torneio_calculado':
          res.status(409).json({ erro: 'O torneio já foi calculado: a planilha não pode mais ser trocada.' });
          return;
      }
    }),
  );

  return rota;
}

/** O cabeçalho só aceita ASCII: o front envia o nome com encodeURIComponent. */
function nomeDoArquivo(cabecalho: string | undefined): string {
  if (!cabecalho) return 'planilha.csv';
  try {
    return decodeURIComponent(cabecalho).slice(0, 255);
  } catch {
    return cabecalho.slice(0, 255);
  }
}
