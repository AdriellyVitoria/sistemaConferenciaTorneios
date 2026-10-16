<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import CartaoDoTorneio from '../componentes/CartaoDoTorneio.vue';
import { formatarCentavos } from '../dominio/dinheiro';
import {
  agruparPorMes,
  contarPorFiltro,
  filtrarTorneios,
  mesDeHoje,
  mesesDisponiveis,
  premiosCalculados,
  rotuloDoMes,
  rotuloDosPremios,
  type Filtro,
  type FiltroDeDivisao,
} from '../dominio/lista-torneios';
import { listarTorneios, type ResumoTorneio } from '../servicos/api';
import { pegarAvisoDaLista } from '../utilitarios/aviso-da-lista';

const torneios = ref<ResumoTorneio[] | null>(null);
const erro = ref<string | null>(null);

const avisoRemovido = ref<string | null>(null);
const elementoDoAviso = ref<HTMLElement | null>(null);

async function mostrarAviso(texto: string) {
  avisoRemovido.value = texto;
  await nextTick();
  elementoDoAviso.value?.focus();
}

onMounted(async () => {
  const deixado = pegarAvisoDaLista();
  try {
    torneios.value = await listarTorneios();
  } catch (e) {
    erro.value = (e as Error).message;
  }
  if (deixado) await mostrarAviso(deixado);
});

async function aoRemover(id: number) {
  torneios.value = (torneios.value ?? []).filter((t) => t.id !== id);
  await mostrarAviso('Torneio removido.');
}

const mesAtual = mesDeHoje();

const PADRAO = { situacao: 'todos' as Filtro, divisao: 'todas' as FiltroDeDivisao, mes: 'todos', busca: '' };

const filtro = ref<Filtro>(PADRAO.situacao);
const divisao = ref<FiltroDeDivisao>(PADRAO.divisao);
const mes = ref(PADRAO.mes);
const busca = ref(PADRAO.busca);

const temFiltro = computed(
  () => filtro.value !== PADRAO.situacao || divisao.value !== PADRAO.divisao || mes.value !== PADRAO.mes || busca.value !== PADRAO.busca,
);

const anuncioDosFiltros = ref('');
const primeiroFiltro = ref<HTMLButtonElement | null>(null);

async function limparFiltros() {
  filtro.value = PADRAO.situacao;
  divisao.value = PADRAO.divisao;
  mes.value = PADRAO.mes;
  busca.value = PADRAO.busca;
  await nextTick();
  const quantos = visiveis.value.length;
  anuncioDosFiltros.value = `Filtros limpos: ${quantos} ${quantos === 1 ? 'torneio' : 'torneios'}.`;
  primeiroFiltro.value?.focus();
}

const lista = computed(() => torneios.value ?? []);
const filtros = computed(() => ({ situacao: filtro.value, busca: busca.value, mes: mes.value, divisao: divisao.value }));
const visiveis = computed(() => filtrarTorneios(lista.value, filtros.value));
const contagem = computed(() => contarPorFiltro(filtrarTorneios(lista.value, { ...filtros.value, situacao: 'todos' })));
const grupos = computed(() => agruparPorMes(visiveis.value, mesAtual, { abrirTodos: busca.value.trim() !== '' || mes.value !== 'todos' }));
const meses = computed(() => mesesDisponiveis(lista.value));
const emAndamentoNoTotal = computed(() => contarPorFiltro(lista.value).andamento);

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'andamento', rotulo: 'Em andamento' },
  { id: 'calculados', rotulo: 'Calculados' },
];
const DIVISOES: { id: FiltroDeDivisao; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'minutos', rotulo: 'Minutos' },
  { id: 'kills', rotulo: 'Kills' },
];
</script>

<template>
  <main class="pagina">
    <div class="titulo-com-acao">
      <div class="titulo-da-pagina">
        <h1>Torneios</h1>
        <p class="texto-suave">Crie o torneio, suba a planilha e o sistema confere cada partida no site oficial.</p>
      </div>
      <RouterLink :to="{ name: 'novo-torneio' }" class="botao">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Novo torneio
      </RouterLink>
    </div>

    <p v-if="avisoRemovido" ref="elementoDoAviso" class="aviso sucesso aviso-removido" role="status" tabindex="-1">{{ avisoRemovido }}</p>

    <p v-if="erro" class="aviso erro" role="alert">{{ erro }}</p>
    <p v-else-if="torneios === null" class="texto-suave">Carregando os torneios…</p>

    <section v-else-if="torneios.length === 0" class="cartao vazio">
      <h2>Nenhum torneio ainda</h2>
      <p class="texto-medio">Comece criando o torneio: nome, prêmio, percentuais de cada posição e a forma de divisão entre os jogadores.</p>
      <div><RouterLink :to="{ name: 'novo-torneio' }" class="botao">Criar o primeiro torneio</RouterLink></div>
    </section>

    <template v-else>
      <section aria-label="Resumo" class="resumo">
        <div class="cartao-numero">
          <span class="rotulo-numero">Em andamento</span>
          <strong class="numero-grande numeral">{{ emAndamentoNoTotal }}</strong>
        </div>
        <div class="cartao-numero">
          <span class="rotulo-numero">{{ rotuloDosPremios(mes, mesAtual) }}</span>
          <strong class="numero-grande mono dinheiro">{{ formatarCentavos(premiosCalculados(torneios, mes)) }}</strong>
        </div>
      </section>

      <div class="controles">
          <div role="tablist" aria-label="Filtrar torneios" class="segmentos">
            <button
              v-for="(f, i) in FILTROS"
              :key="f.id"
              :ref="(el) => { if (i === 0) primeiroFiltro = el as HTMLButtonElement | null; }"
              type="button"
              role="tab"
              class="segmento"
              :aria-selected="filtro === f.id"
              aria-controls="lista-torneios"
              @click="filtro = f.id"
            >
              {{ f.rotulo }} <span class="numeral">{{ contagem[f.id] }}</span>
            </button>
          </div>
          <div class="grupo-de-filtro">
            <span class="ajuda" aria-hidden="true">Divisão</span>
            <div role="group" aria-label="Divisão" class="segmentos">
              <button
                v-for="d in DIVISOES"
                :key="d.id"
                type="button"
                class="segmento"
                :aria-pressed="divisao === d.id"
                @click="divisao = d.id"
              >
                {{ d.rotulo }}
              </button>
            </div>
          </div>
          <div class="grupo mes">
            <label for="filtro-mes" class="ajuda">Mês</label>
            <select id="filtro-mes" v-model="mes" class="campo">
              <option value="todos">Todos os meses</option>
              <option v-for="m in meses" :key="m" :value="m">{{ rotuloDoMes(m) }}</option>
            </select>
          </div>
          <div class="grupo busca">
            <label for="busca-torneio" class="ajuda">Buscar torneio</label>
            <input id="busca-torneio" v-model="busca" type="search" class="campo" placeholder="Nome do torneio" autocomplete="off" />
          </div>
          <button v-if="temFiltro" type="button" class="botao secundario limpar" @click="limparFiltros">Limpar filtros</button>
      </div>
      <p class="visualmente-oculto anuncio-dos-filtros" role="status">{{ anuncioDosFiltros }}</p>

      <div id="lista-torneios" role="tabpanel" class="lista" aria-live="polite">
        <section v-if="grupos.emAndamento.length" class="grupo-andamento" aria-labelledby="t-em-andamento">
          <h2 id="t-em-andamento" class="titulo-do-grupo">Em andamento</h2>
          <CartaoDoTorneio v-for="t in grupos.emAndamento" :key="t.id" :torneio="t" @removido="aoRemover(t.id)" />
        </section>

        <details v-for="g in grupos.meses" :key="g.mes" class="grupo-do-mes" :open="g.aberto">
          <summary>
            <span class="nome-do-mes">{{ g.rotulo }}</span>
            <span class="resumo-do-mes texto-suave">{{ g.resumo }}</span>
          </summary>
          <div class="torneios-do-mes">
            <CartaoDoTorneio v-for="t in g.torneios" :key="t.id" :torneio="t" @removido="aoRemover(t.id)" />
          </div>
        </details>

        <p v-if="visiveis.length === 0" class="nenhum">Nenhum torneio encontrado.</p>
      </div>
    </template>
  </main>
</template>

<style scoped>
.vazio {
  align-items: flex-start;
}
.resumo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--espaco-3);
}
.cartao-numero {
  background: var(--superficie);
  border: 1px solid var(--borda);
  border-radius: var(--raio-grande);
  padding: var(--espaco-4) 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rotulo-numero {
  font-size: var(--texto-sm);
  color: var(--texto-suave);
}
.numero-grande {
  font-size: var(--texto-numero);
  font-weight: var(--peso-forte);
  line-height: 1.3;
}
.numero-grande.dinheiro {
  font-weight: var(--peso-medio);
}
.controles {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--espaco-3) var(--espaco-4);
}
.grupo-de-filtro {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mes {
  flex: 0 1 180px;
  gap: 2px;
}
.busca {
  flex: 1 1 220px;
  gap: 2px;
}
.lista {
  display: flex;
  flex-direction: column;
  gap: var(--espaco-5);
}
.grupo-andamento,
.torneios-do-mes {
  display: flex;
  flex-direction: column;
  gap: var(--espaco-3);
}
.titulo-do-grupo {
  font-size: var(--texto-lg);
}
.grupo-do-mes summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--espaco-1) var(--espaco-3);
  cursor: pointer;
  min-height: var(--alvo-toque);
  padding: var(--espaco-2) 0;
  list-style: none;
}
.grupo-do-mes summary::-webkit-details-marker {
  display: none;
}
.grupo-do-mes summary::before {
  content: '';
  align-self: center;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--texto-suave);
  border-bottom: 2px solid var(--texto-suave);
  transform: rotate(-45deg);
  transition: transform 0.15s;
  margin-right: var(--espaco-1);
}
.grupo-do-mes[open] summary::before {
  transform: rotate(45deg);
}
@media (prefers-reduced-motion: reduce) {
  .grupo-do-mes summary::before {
    transition: none;
  }
}
.grupo-do-mes summary:focus-visible {
  outline: 2px solid var(--primaria);
  outline-offset: 2px;
  border-radius: var(--raio-pequeno);
}
.nome-do-mes {
  font-size: var(--texto-lg);
  font-weight: var(--peso-forte);
}
.resumo-do-mes {
  font-size: var(--texto-sm);
}
.grupo-do-mes[open] summary {
  margin-bottom: var(--espaco-3);
}
.nenhum {
  background: var(--superficie);
  border: 1px dashed var(--borda-campo);
  border-radius: var(--raio-grande);
  padding: 28px;
  text-align: center;
  color: var(--texto-suave);
}
@media (max-width: 640px) {
  .grupo-de-filtro,
  .mes,
  .busca,
  .limpar {
    flex-basis: 100%;
    width: 100%;
  }
}
</style>
