import { readFileSync } from 'node:fs';

/** Uma partida como o site oficial registra (mesmo formato de testes/site-oficial.json). */
export interface Partida {
  id: string;
  data: string;
  rodada?: number;
  times: [string, string];
  vencedor: string;
  jogadores: { nick: string; time: string; minutos: number; kills: number }[];
  /** Configuração do simulador, não faz parte da resposta (usada no pedaço 2b). */
  falhas_antes_de_responder?: number;
}

/**
 * Lê os arquivos de dados ao subir e junta tudo num mapa por ID ("#40923" -> partida).
 * Os arquivos são só lidos. O mesmo ID em dois arquivos é erro: o simulador não escolhe um em silêncio.
 */
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
