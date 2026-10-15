<script setup lang="ts">
/**
 * A tela do resultado (6e, protótipo 2-resultado): o que foi gravado no cálculo, nada recalculado.
 * Cabeçalho (data, modo travado, total distribuído e o CSV), classificação com o critério e a
 * frase dos empates (D2), e o prêmio por jogador com o filtro por nick. Os links por time são da
 * etapa 7.
 */
import { computed, onMounted, ref, useId } from 'vue';
import { RouterLink } from 'vue-router';
import { formatarHora } from '../dominio/conferencia';
import { formatarCentavos } from '../dominio/dinheiro';
import { buscarNoResultado, explicarEmpates, observacaoDoJogador, percentualDoTime, rotuloDoCriterio } from '../dominio/resultado';
import { formatarDataDeCriacao, rotuloDoModo } from '../dominio/torneio';
import { buscarResultado, enderecoDoCsv, type ResultadoDoTorneio } from '../servicos/api';

const props = defineProps<{ id: number }>();

const resultado = ref<ResultadoDoTorneio | null>(null);
const erro = ref<string | null>(null);

onMounted(async () => {
  try {
    const lido = await buscarResultado(props.id);
    if (lido.tipo === 'ok') resultado.value = lido.resultado;
    else erro.value = lido.mensagem;
  } catch (e) {
    erro.value = (e as Error).message;
  }
});

const busca = ref('');
const idDoFiltro = `filtro-nick-${useId()}`;

const totalDistribuido = computed(() => (resultado.value?.jogadores ?? []).reduce((soma, j) => soma + j.premioCentavos, 0));
const premiados = computed(() => (resultado.value?.jogadores ?? []).filter((j) => j.premioCentavos > 0));
const encontrados = computed(() => buscarNoResultado(resultado.value?.jogadores ?? [], busca.value));
const empates = computed(() => (resultado.value ? explicarEmpates(resultado.value.times, resultado.value.percentuais) : []));
const quando = computed(() => {
  const iso = resultado.value?.calculadoEm;
  return iso ? `${formatarDataDeCriacao(iso)} às ${formatarHora(iso).slice(0, 5)}` : '';
});
const rotuloDaBase = computed(() => (resultado.value?.modoDivisao === 'kills' ? 'Kills' : 'Minutos'));

/** O rodapé da tabela, anunciado ao leitor de tela quando o filtro muda. */
const resumo = computed(() => {
  const total = premiados.value.length;
  const palavra = total === 1 ? 'jogador premiado' : 'jogadores premiados';
  if (!busca.value.trim()) return `${total} ${palavra} · soma: ${formatarCentavos(totalDistribuido.value)}`;
  return `${encontrados.value.premiados.length} de ${total} ${palavra}`;
});
</script>

<template>
  <main class="pagina">
    <div class="trilha">
      <RouterLink to="/">Torneios</RouterLink> /
      <RouterLink :to="{ name: 'torneio', params: { id } }">{{ resultado?.torneio.nome ?? 'Torneio' }}</RouterLink> / Resultado
    </div>

    <template v-if="erro">
      <section class="cartao">
        <p class="aviso alerta" role="alert">{{ erro }}</p>
        <div><RouterLink :to="{ name: 'torneio', params: { id } }" class="botao secundario">Voltar ao torneio</RouterLink></div>
      </section>
    </template>
    <p v-else-if="!resultado" class="texto-suave">Carregando o resultado…</p>

    <template v-else>
      <div class="titulo-com-acao">
        <div class="titulo-da-pagina">
          <h1>Resultado: {{ resultado.torneio.nome }}</h1>
          <p class="texto-suave">Calculado em {{ quando }} · {{ rotuloDoModo(resultado.modoDivisao) }} (travada)</p>
        </div>
        <div class="acoes-topo">
          <span class="selo sucesso redondo total">Total distribuído: {{ formatarCentavos(totalDistribuido) }}</span>
          <a :href="enderecoDoCsv(id)" class="botao secundario" download>Baixar CSV</a>
        </div>
      </div>

      <section class="cartao" aria-labelledby="t-classificacao">
        <h2 id="t-classificacao">Classificação</h2>
        <div class="caixa-tabela">
          <table class="tabela-resultado">
            <caption class="visualmente-oculto">Classificação</caption>
            <thead>
              <tr>
                <th scope="col">Posição</th>
                <th scope="col">Time</th>
                <th scope="col" class="numero">Vitórias</th>
                <th scope="col" class="numero">Kills do time</th>
                <th scope="col" class="numero">Prêmio</th>
                <th scope="col">Critério</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in resultado.times" :key="t.time" :class="{ sem_premio: t.premioCentavos === 0 }">
                <th scope="row" class="forte">{{ t.posicao }}º</th>
                <td class="forte">{{ t.time }}</td>
                <td class="numero numeral">{{ t.vitorias }}</td>
                <td class="numero numeral">{{ t.killsTime }}</td>
                <td class="numero mono">{{ t.premioCentavos > 0 ? formatarCentavos(t.premioCentavos) : '—' }}</td>
                <td>
                  <span v-if="rotuloDoCriterio(t.criterio)" class="selo" :class="rotuloDoCriterio(t.criterio)!.tom">{{ rotuloDoCriterio(t.criterio)!.texto }}</span>
                  <span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-for="frase in empates" :key="frase" class="quadro-suave">{{ frase }}</p>
      </section>

      <section class="cartao" aria-labelledby="t-jogadores">
        <div class="titulo-com-acao">
          <h2 id="t-jogadores">Prêmio por jogador</h2>
          <div class="grupo filtro">
            <label :for="idDoFiltro" class="ajuda">Filtrar por nick</label>
            <input :id="idDoFiltro" v-model="busca" type="search" class="campo" placeholder="Ex.: Tuca" autocomplete="off" />
          </div>
        </div>

        <div v-if="encontrados.premiados.length" class="caixa-tabela">
          <table class="tabela-resultado">
            <caption class="visualmente-oculto">Prêmio por jogador</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Nick</th>
                <th scope="col" class="numero">{{ rotuloDaBase }}</th>
                <th scope="col" class="numero">% do time</th>
                <th scope="col" class="numero">Valor</th>
                <th scope="col">Observação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in encontrados.premiados" :key="`${j.time}|${j.nick}`">
                <td class="texto-medio">{{ j.time }}</td>
                <td class="forte">{{ j.nick }}</td>
                <td class="numero numeral">{{ j.base }} de {{ j.baseTime }}</td>
                <td class="numero numeral">{{ percentualDoTime(j.base, j.baseTime) }}</td>
                <td class="numero mono forte">{{ formatarCentavos(j.premioCentavos) }}</td>
                <td class="observacao">{{ observacaoDoJogador(j) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul v-if="encontrados.semPremio.length" class="sem-premio">
          <li v-for="frase in encontrados.semPremio" :key="frase" class="quadro-suave">{{ frase }}</li>
        </ul>
        <p v-if="encontrados.nenhum" class="texto-medio">Nenhum jogador com esse nick neste torneio.</p>

        <p class="resumo-jogadores texto-suave" aria-live="polite">{{ resumo }}</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.acoes-topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espaco-3);
}
.total {
  font-size: var(--texto-sm);
  padding: 6px 14px;
}
/* a tabela rola dentro da caixa no celular; a página não */
.caixa-tabela {
  overflow-x: auto;
  min-width: 0;
}
.tabela-resultado {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  overflow-wrap: normal;
}
.tabela-resultado thead th {
  text-align: left;
  font-size: var(--texto-sm);
  font-weight: var(--peso-medio);
  color: var(--texto-suave);
  padding: 10px var(--espaco-2);
  border-bottom: 1px solid var(--borda);
  white-space: nowrap;
}
.tabela-resultado td,
.tabela-resultado tbody th {
  text-align: left;
  font-weight: var(--peso-normal);
  padding: var(--espaco-3) var(--espaco-2);
  border-bottom: 1px solid var(--linha-tabela);
  white-space: nowrap;
}
.tabela-resultado .numero {
  text-align: right;
}
.tabela-resultado .forte {
  font-weight: var(--peso-forte);
}
.tabela-resultado tr:last-child td,
.tabela-resultado tr:last-child th {
  border-bottom: none;
}
.tabela-resultado tr.sem_premio td,
.tabela-resultado tr.sem_premio th {
  color: var(--texto-suave);
  font-weight: var(--peso-normal);
}
.observacao {
  font-size: var(--texto-sm);
  color: var(--alerta);
  white-space: normal;
  min-width: 180px;
}
.filtro {
  flex: 0 1 260px;
  gap: var(--espaco-1);
}
.sem-premio {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espaco-2);
}
@media (max-width: 640px) {
  .filtro {
    flex-basis: 100%;
  }
  .acoes-topo .botao {
    width: 100%;
  }
}
</style>
