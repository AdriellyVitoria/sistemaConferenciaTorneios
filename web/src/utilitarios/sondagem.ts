/**
 * Consulta periódica (polling) da tela de progresso (etapa 4c): chama `atualizar` a cada
 * `intervaloMs` enquanto ela responder que precisa continuar, e para sozinha quando não precisa.
 *
 * - Usa setTimeout encadeado, e não setInterval: a próxima consulta só é marcada quando a
 *   anterior volta, então duas consultas nunca se sobrepõem se a API estiver lenta.
 * - `parar` (ao sair da página) cancela o que estiver marcado; uma consulta já em andamento
 *   termina, mas não marca outra. Nenhum timer fica esquecido.
 * - Erro na consulta (API fora do ar) não para a sondagem: tenta de novo no próximo intervalo.
 */

export interface Sondagem {
  /** Liga, se ainda não estiver ligada. A primeira consulta é depois de um intervalo. */
  garantirAtiva(): void;
  parar(): void;
  ativa(): boolean;
}

export function criarSondagem({ atualizar, intervaloMs }: { atualizar: () => Promise<boolean>; intervaloMs: number }): Sondagem {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ligada = false;
  // muda a cada parar(): uma consulta que volta depois disso sabe que não deve marcar outra
  let geracao = 0;

  function marcar(minhaGeracao: number) {
    timer = setTimeout(async () => {
      timer = undefined;
      let continuar: boolean;
      try {
        continuar = await atualizar();
      } catch {
        continuar = true;
      }
      if (minhaGeracao !== geracao) return;
      if (continuar) marcar(minhaGeracao);
      else ligada = false;
    }, intervaloMs);
  }

  return {
    garantirAtiva() {
      if (ligada) return;
      ligada = true;
      marcar(geracao);
    },
    parar() {
      geracao++;
      ligada = false;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
    ativa: () => ligada,
  };
}
