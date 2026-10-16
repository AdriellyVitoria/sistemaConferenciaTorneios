<script setup lang="ts">
import { computed, ref } from 'vue';
import LadoALado from './LadoALado.vue';
import { formatarHora } from '../dominio/conferencia';
import {
  agruparPorRodada,
  contarConferidas,
  descricaoCurta,
  filtrarConferidas,
  resumoDaDiferenca,
  type FiltroConferidas,
  type PartidaConferida,
} from '../dominio/pendencias';
import { rotuloDoId } from '../dominio/torneio';
import { definirCiente, type Pendencia } from '../servicos/api';

const props = defineProps<{
  torneioId: number;
  conferidas: PartidaConferida[];
  somenteLeitura: boolean;
  recarregar: () => Promise<void>;
}>();

const filtro = ref<FiltroConferidas>('todas');
const contagem = computed(() => contarConferidas(props.conferidas));
const grupos = computed(() => agruparPorRodada(filtrarConferidas(props.conferidas, filtro.value)));
const FILTROS: { id: FiltroConferidas; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'bateram', rotulo: 'Bateram com o site' },
  { id: 'com_ciente', rotulo: 'Com Ciente' },
];

const abertas = ref(new Set<number>());
function alternar(partidaId: number) {
  const novas = new Set(abertas.value);
  if (novas.has(partidaId)) novas.delete(partidaId);
  else novas.add(partidaId);
  abertas.value = novas;
}

const aviso = ref<{ tom: 'sucesso' | 'alerta' | 'erro'; texto: string } | null>(null);
const enviando = ref<string | null>(null);

async function desfazer(p: Pendencia) {
  enviando.value = p.chave;
  aviso.value = null;
  try {
    const resultado = await definirCiente(props.torneioId, p.chave, false);
    await props.recarregar();
    if (resultado.tipo === 'ok') aviso.value = { tom: 'sucesso', texto: 'Ciente desfeito: a partida voltou para Pendências.' };
    else if (resultado.tipo === 'mudou') aviso.value = { tom: 'alerta', texto: 'Os dados desta pendência mudaram: a lista foi atualizada. Confira de novo em Pendências.' };
    else aviso.value = { tom: 'erro', texto: resultado.mensagem };
  } catch (e) {
    aviso.value = { tom: 'erro', texto: (e as Error).message };
  } finally {
    enviando.value = null;
  }
}

const kills = (c: PartidaConferida) => (c.partida.killsSite ? `${c.partida.killsSite.timeA} × ${c.partida.killsSite.timeB}` : '—');
</script>

<template>
  <div class="aba-conferidas">
    <div class="topo">
      <p class="texto-medio">
        Estas partidas estão confirmadas pelo site oficial. Os números abaixo são os do site, que é o que entra no cálculo.
      </p>
      <div role="group" aria-label="Filtrar conferidas" class="filtros">
        <button
          v-for="f in FILTROS"
          :key="f.id"
          type="button"
          class="filtro"
          :aria-pressed="filtro === f.id"
          @click="filtro = f.id"
        >
          {{ f.rotulo }} · {{ contagem[f.id] }}
        </button>
      </div>
    </div>

    <p v-if="aviso" class="aviso" :class="aviso.tom" :role="aviso.tom === 'sucesso' ? 'status' : 'alert'">{{ aviso.texto }}</p>

    <p v-if="conferidas.length === 0" class="texto-medio">Nenhuma partida conferida ainda.</p>
    <p v-else-if="grupos.length === 0" class="texto-medio">Nenhuma partida neste filtro.</p>

    <div v-else class="caixa-tabela">
      <table class="tabela-conferidas">
        <caption class="visualmente-oculto">Partidas conferidas com o site oficial</caption>
        <thead>
          <tr>
            <th scope="col">Partida</th>
            <th scope="col">Times</th>
            <th scope="col" class="numero">Kills</th>
            <th scope="col">Vencedor</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody v-for="g in grupos" :key="g.rodada">
          <tr class="rodada">
            <th scope="rowgroup" colspan="5">Rodada {{ g.rodada }} · {{ g.data }}</th>
          </tr>
          <template v-for="c in g.itens" :key="c.partida.id">
            <tr class="partida">
              <td class="mono">{{ rotuloDoId(c.partida) }}</td>
              <td>{{ c.partida.timeA }} × {{ c.partida.timeB }}</td>
              <td class="numero numeral">{{ kills(c) }}</td>
              <td class="vencedor">{{ c.partida.vencedor ?? '—' }}</td>
              <td>
                <span v-if="c.comCiente.length === 0" class="selo sucesso">Bateu com o site</span>
                <div v-else class="com-ciente">
                  <span class="selo info">Conferida com Ciente</span>
                  <span v-for="p in c.comCiente" :key="p.chave" class="resumo">
                    {{ resumoDaDiferenca(p) }}<template v-if="p.cienteEm"> · Ciente às {{ formatarHora(p.cienteEm).slice(0, 5) }}</template>
                  </span>
                  <button
                    type="button"
                    class="botao-texto ver"
                    :aria-expanded="abertas.has(c.partida.id)"
                    :aria-controls="`diferenca-${c.partida.id}`"
                    @click="alternar(c.partida.id)"
                  >
                    {{ abertas.has(c.partida.id) ? 'Esconder a diferença' : 'Ver a diferença' }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="c.comCiente.length" v-show="abertas.has(c.partida.id)" :id="`diferenca-${c.partida.id}`" class="detalhe">
              <td colspan="5">
                <div v-for="p in c.comCiente" :key="p.chave" class="diferenca">
                  <p class="texto-medio">{{ p.mensagem }}</p>
                  <LadoALado :pendencia="p" />
                  <div v-if="!somenteLeitura" class="acoes">
                    <button
                      type="button"
                      class="botao neutro"
                      :disabled="enviando === p.chave"
                      :aria-label="`Desfazer o Ciente: ${descricaoCurta(p)}`"
                      @click="desfazer(p)"
                    >
                      Desfazer
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p class="texto-suave">
      <template v-if="somenteLeitura">O torneio já foi calculado: as conferidas ficam só para consulta.</template>
      <template v-else>Mudou de ideia sobre um Ciente? Use "Ver a diferença" e desfaça: a partida volta para Pendências até o cálculo.</template>
    </p>
  </div>
</template>

<style scoped>
.aba-conferidas {
  display: flex;
  flex-direction: column;
  gap: var(--espaco-4);
  padding-top: var(--espaco-4);
}
.topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--espaco-3);
}
.topo p {
  flex: 1 1 320px;
  max-width: 620px;
}
.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: var(--espaco-2);
}
.filtro {
  font: inherit;
  font-size: var(--texto-md);
  font-variant-numeric: tabular-nums;
  background: var(--superficie);
  color: var(--texto);
  border: 1px solid var(--borda-campo);
  border-radius: var(--raio-pilula);
  padding: var(--espaco-2) 14px;
  min-height: var(--alvo-toque);
  cursor: pointer;
}
.filtro[aria-pressed='true'] {
  background: var(--texto);
  border-color: var(--texto);
  color: var(--superficie);
  font-weight: var(--peso-forte);
}
.caixa-tabela {
  border: 1px solid var(--borda);
  border-radius: var(--raio-grande);
  overflow-x: auto;
  min-width: 0;
}
.tabela-conferidas {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  overflow-wrap: normal;
}
.tabela-conferidas thead th,
.tabela-conferidas tr.partida td:nth-child(-n + 4) {
  white-space: nowrap;
}
.tabela-conferidas thead th {
  text-align: left;
  font-size: var(--texto-sm);
  font-weight: var(--peso-forte);
  color: var(--texto-suave);
  padding: var(--espaco-3) var(--espaco-4);
  border-bottom: 1px solid var(--borda);
}
.tabela-conferidas td {
  padding: var(--espaco-3) var(--espaco-4);
  border-bottom: 1px solid var(--linha-tabela);
  vertical-align: top;
}
.tabela-conferidas .numero {
  text-align: right;
}
.rodada th {
  text-align: left;
  background: var(--superficie-suave);
  padding: var(--espaco-2) var(--espaco-4);
  font-size: var(--texto-sm);
  font-weight: var(--peso-forte);
  color: var(--texto-medio);
}
.vencedor {
  font-weight: var(--peso-forte);
}
.com-ciente {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--espaco-1);
}
.resumo {
  font-size: var(--texto-sm);
  color: var(--texto-suave);
}
.ver {
  padding: 0;
  min-height: var(--alvo-toque);
  font-size: var(--texto-sm);
  text-decoration: underline;
}
.detalhe td {
  background: var(--superficie-suave);
}
.diferenca {
  display: flex;
  flex-direction: column;
  gap: var(--espaco-3);
  padding: var(--espaco-2) 0;
}
.diferenca + .diferenca {
  border-top: 1px solid var(--borda);
  padding-top: var(--espaco-4);
}
.acoes {
  display: flex;
  justify-content: flex-end;
}
</style>
