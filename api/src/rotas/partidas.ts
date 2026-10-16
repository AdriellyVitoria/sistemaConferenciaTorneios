import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { assincrono } from './assincrono';
import { corrigirId } from '../servicos/partidas';

const esquemaId = z.coerce.number().int().positive();
const esquemaCorpo = z.object({
  idPartida: z.string({ required_error: 'Informe o ID novo da partida.', invalid_type_error: 'O ID da partida precisa ser um texto, como "#45659".' }),
});

export function rotasPartidas(bd: Knex, agora: () => Date = () => new Date()): Router {
  const rota = Router();

  rota.put('/torneios/:id/partidas/:partidaId/id-partida', assincrono(async (req, res) => {
    const torneioId = esquemaId.safeParse(req.params.id);
    const partidaId = esquemaId.safeParse(req.params.partidaId);
    if (!torneioId.success || !partidaId.success) {
      res.status(404).json({ erro: 'Partida não encontrada neste torneio.' });
      return;
    }
    const corpo = esquemaCorpo.safeParse(req.body);
    if (!corpo.success) {
      res.status(400).json({ erro: corpo.error.issues[0].message });
      return;
    }

    const resultado = await corrigirId(bd, torneioId.data, partidaId.data, corpo.data.idPartida, agora());
    switch (resultado.tipo) {
      case 'corrigida':
        res.json(resultado.partida);
        return;
      case 'invalido':
        res.status(400).json({ erro: resultado.mensagem });
        return;
      case 'mesmo_id':
        res.status(400).json({ erro: 'Esse já é o ID da partida.' });
        return;
      case 'id_em_uso':
        res.status(409).json({ erro: `O ID ${resultado.idPartida} já é de outra partida deste torneio. Confira o ID: cada partida tem o seu.` });
        return;
      case 'torneio_calculado':
        res.status(409).json({ erro: 'O torneio já foi calculado: o ID da partida não pode mais mudar.' });
        return;
      case 'nao_encontrada':
        res.status(404).json({ erro: 'Partida não encontrada neste torneio.' });
        return;
    }
  }));

  return rota;
}
