export interface Sondagem {
  garantirAtiva(): void;
  parar(): void;
  ativa(): boolean;
}

export function criarSondagem({ atualizar, intervaloMs }: { atualizar: () => Promise<boolean>; intervaloMs: number }): Sondagem {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ligada = false;
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
