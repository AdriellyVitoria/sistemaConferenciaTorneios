import { Router, type Response } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { assincrono } from './assincrono';
import { cienteDeTodas, definirCiente, listarPendencias, type ResultadoCiente } from '../servicos/pendencias';

const esquemaId = z.coerce.number().int().positive();
const esquemaChave = z.string().regex(/^[0-9a-f]{64}$/);

const TORNEIO_NAO_ENCONTRADO = 'Torneio não encontrado.';
const TORNEIO_CALCULADO = 'O torneio já foi calculado: os Cientes não podem mais mudar.';

export function rotasPendencias(bd: Knex, agora: () => Date = () => new Date()): Router {
  const rota = Router();

  rota.get('/torneios/:id/pendencias', assincrono(async (req, res) => {
    const id = esquemaId.safeParse(req.params.id);
    const lista = id.success ? await listarPendencias(bd, id.data) : null;
    if (!lista) {
      res.status(404).json({ erro: TORNEIO_NAO_ENCONTRADO });
      return;
    }
    res.json(lista);
  }));

  for (const [metodo, ciente] of [['put', true], ['delete', false]] as const) {
    rota[metodo]('/torneios/:id/pendencias/:chave/ciente', assincrono(async (req, res) => {
      const id = esquemaId.safeParse(req.params.id);
      const chave = esquemaChave.safeParse(req.params.chave);
      if (!id.success) {
        res.status(404).json({ erro: TORNEIO_NAO_ENCONTRADO });
        return;
      }
      const resultado: ResultadoCiente = chave.success
        ? await definirCiente(bd, id.data, chave.data, ciente, agora())
        : { tipo: 'pendencia_nao_encontrada' };
      responderCiente(res, resultado, req.params.chave, ciente);
    }));
  }

  rota.post('/torneios/:id/pendencias/ciente-de-todas', assincrono(async (req, res) => {
    const id = esquemaId.safeParse(req.params.id);
    const resultado = id.success ? await cienteDeTodas(bd, id.data, agora()) : ({ tipo: 'torneio_nao_encontrado' } as const);
    switch (resultado.tipo) {
      case 'marcadas':
        res.json({ marcadas: resultado.marcadas });
        return;
      case 'aguardando_site': {
        const n = resultado.aguardandoSite;
        const quantas = n === 1 ? '1 partida ainda aguarda' : `${n} partidas ainda aguardam`;
        res.status(409).json({ erro: `${quantas} o site: o "Ciente de todas" só libera depois que o site conferir todas. Enquanto isso, dê Ciente uma a uma.` });
        return;
      }
      case 'torneio_calculado':
        res.status(409).json({ erro: TORNEIO_CALCULADO });
        return;
      case 'torneio_nao_encontrado':
        res.status(404).json({ erro: TORNEIO_NAO_ENCONTRADO });
        return;
    }
  }));

  return rota;
}

function responderCiente(res: Response, resultado: ResultadoCiente, chave: string, ciente: boolean) {
  switch (resultado.tipo) {
    case 'feito':
      res.json({ chave, ciente });
      return;
    case 'bloqueante':
      res.status(409).json({ erro: 'Esta pendência não aceita Ciente: ela se resolve corrigindo o ID da partida.' });
      return;
    case 'pendencia_nao_encontrada':
      res.status(404).json({ erro: 'Esta pendência não existe mais: os dados mudaram. Atualize a lista e confira de novo.' });
      return;
    case 'torneio_calculado':
      res.status(409).json({ erro: TORNEIO_CALCULADO });
      return;
    case 'torneio_nao_encontrado':
      res.status(404).json({ erro: TORNEIO_NAO_ENCONTRADO });
      return;
  }
}
