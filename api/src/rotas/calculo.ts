/**
 * Rota do cálculo (etapa 6b). Só recebe, valida e responde; as regras ficam no serviço.
 *
 *   POST /torneios/:id/calculo   calcula, grava o resultado congelado e trava o torneio.
 *       200: o resultado gravado.
 *       409: ainda não dá para calcular (com as contagens do que falta), já foi calculado, ou
 *            uma regra de negócio impediu a conta (a frase do domínio para a Maria).
 */

import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { assincrono } from './assincrono';
import type { SituacaoDoCalculo } from '../dominio/pronto-para-calcular';
import { calcularTorneio } from '../servicos/calculo';

const esquemaId = z.coerce.number().int().positive();

/** "Ainda não dá para calcular: 2 aguardando o site, 1 bloqueio, 3 sem Ciente." */
export function motivoDeNaoPoder(c: SituacaoDoCalculo): string {
  if (c.semPlanilha) return 'Ainda não dá para calcular: envie a planilha.';
  const faltas: string[] = [];
  if (c.aguardandoSite) faltas.push(`${c.aguardandoSite} aguardando o site`);
  if (c.bloqueios) faltas.push(`${c.bloqueios} ${c.bloqueios === 1 ? 'bloqueio' : 'bloqueios'}`);
  if (c.semCiente) faltas.push(`${c.semCiente} sem Ciente`);
  return `Ainda não dá para calcular: ${faltas.join(', ')}.`;
}

export function rotasCalculo(bd: Knex, agora: () => Date = () => new Date()): Router {
  const rota = Router();

  rota.post('/torneios/:id/calculo', assincrono(async (req, res) => {
    const id = esquemaId.safeParse(req.params.id);
    const resultado = id.success ? await calcularTorneio(bd, id.data, agora()) : ({ tipo: 'torneio_nao_encontrado' } as const);
    switch (resultado.tipo) {
      case 'calculado':
        res.json(resultado.resultado);
        return;
      case 'nao_pode':
        res.status(409).json({ erro: motivoDeNaoPoder(resultado.calculo), calculo: resultado.calculo });
        return;
      case 'ja_calculado':
        res.status(409).json({ erro: 'O torneio já foi calculado.' });
        return;
      case 'impossivel':
        // a frase do domínio, escrita para a Maria (code review, item 4)
        res.status(409).json({ erro: resultado.mensagem });
        return;
      case 'torneio_nao_encontrado':
        res.status(404).json({ erro: 'Torneio não encontrado.' });
        return;
    }
  }));

  return rota;
}
