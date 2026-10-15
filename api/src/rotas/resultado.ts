/**
 * Rotas do resultado (etapa 6c). Só o que foi gravado no cálculo: nada é recalculado.
 *
 *   GET /torneios/:id/resultado       configuração usada, data, classificação e jogadores (JSON)
 *   GET /torneios/:id/resultado.csv   o mesmo, para a Maria pagar no Excel (UTF-8 com BOM, ";")
 *
 * Antes do cálculo: 409. O filtro por nick é da tela: são poucos jogadores.
 */

import { Router, type Response } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { assincrono } from './assincrono';
import { csvDoResultado, nomeDoArquivoCsv, nomeDoArquivoCsvComAcentos } from '../dominio/csv-resultado';
import { buscarResultado, type ResultadoGravado } from '../repositorios/resultado';
import { buscarTorneio, type Torneio } from '../repositorios/torneios';

const esquemaId = z.coerce.number().int().positive();
/** A marca invisível (BOM) que diz ao Excel que o arquivo é UTF-8: sem ela, "Falcões" vira "FalcÃµes". */
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

type Leitura = { tipo: 'ok'; torneio: Torneio; resultado: ResultadoGravado } | { tipo: 'nao_encontrado' } | { tipo: 'nao_calculado' };

export function rotasResultado(bd: Knex): Router {
  const rota = Router();

  async function ler(idDaUrl: string): Promise<Leitura> {
    const id = esquemaId.safeParse(idDaUrl);
    const torneio = id.success ? await buscarTorneio(bd, id.data) : null;
    if (!torneio) return { tipo: 'nao_encontrado' };
    const resultado = await buscarResultado(bd, torneio.id);
    return resultado ? { tipo: 'ok', torneio, resultado } : { tipo: 'nao_calculado' };
  }

  function responderErro(res: Response, leitura: Exclude<Leitura, { tipo: 'ok' }>) {
    if (leitura.tipo === 'nao_encontrado') res.status(404).json({ erro: 'Torneio não encontrado.' });
    else res.status(409).json({ erro: 'O torneio ainda não foi calculado.' });
  }

  rota.get('/torneios/:id/resultado.csv', assincrono(async (req, res) => {
    const leitura = await ler(req.params.id);
    if (leitura.tipo !== 'ok') {
      responderErro(res, leitura);
      return;
    }
    const corpo = Buffer.concat([BOM, Buffer.from(csvDoResultado(leitura.resultado.jogadores), 'utf8')]);
    const nome = leitura.torneio.nome;
    res
      .status(200)
      .set('Content-Type', 'text/csv; charset=utf-8')
      // filename: só ASCII, para qualquer navegador; filename*: o nome com acentos (RFC 6266)
      .set('Content-Disposition', `attachment; filename="${nomeDoArquivoCsv(nome)}"; filename*=UTF-8''${encodeURIComponent(nomeDoArquivoCsvComAcentos(nome))}`)
      .send(corpo);
  }));

  rota.get('/torneios/:id/resultado', assincrono(async (req, res) => {
    const leitura = await ler(req.params.id);
    if (leitura.tipo !== 'ok') {
      responderErro(res, leitura);
      return;
    }
    res.json({ torneio: { id: leitura.torneio.id, nome: leitura.torneio.nome }, ...leitura.resultado });
  }));

  return rota;
}
