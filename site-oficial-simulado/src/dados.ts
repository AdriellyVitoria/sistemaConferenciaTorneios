import { readFileSync } from 'node:fs';

export interface Partida {
  id: string;
  data: string;
  rodada?: number;
  times: [string, string];
  vencedor: string;
  jogadores: { nick: string; time: string; minutos: number; kills: number }[];
  falhas_antes_de_responder?: number;
}

export function carregarPartidas(arquivos: string[]): Map<string, Partida> {
  const partidas = new Map<string, Partida>();
  for (const arquivo of arquivos) {
    const conteudo: Record<string, Partida> = JSON.parse(readFileSync(arquivo, 'utf8'));
    for (const [id, partida] of Object.entries(conteudo)) {
      if (partidas.has(id)) throw new Error(`ID de partida repetido nos dados do simulador: ${id} (em ${arquivo}).`);
      partidas.set(id, partida);
    }
  }
  return partidas;
}
