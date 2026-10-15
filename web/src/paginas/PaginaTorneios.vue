<script setup lang="ts">
/**
 * A lista de torneios (página inicial), agrupada por mês (M1): "Em andamento" sempre no topo, de
 * qualquer mês, e abaixo um grupo por mês da primeira partida, do mais recente para o mais antigo,
 * com o mês atual aberto e os anteriores recolhidos. Filtros: situação, divisão, mês e busca.
 */
import { computed, onMounted, ref } from 'vue';
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

const torneios = ref<ResumoTorneio[] | null>(null);
const erro = ref<string | null>(null);

onMounted(async () => {
  try {
    torneios.value = await listarTorneios();
  } catch (e) {
    erro.value = (e as Error).message;
  }
});

const mesAtual = mesDeHoje();

const filtro = ref<Filtro>('todos');
const divisao = ref<FiltroDeDivisao>('todas');
const mes = ref('todos');
const busca = ref('');

const lista = computed(() => torneios.value ?? []);
const filtros = computed(() => ({ situacao: filtro.value, busca: busca.value, mes: mes.value, divisao: divisao.value }));
const visiveis = computed(() => filtrarTorneios(lista.value, filtros.value));
// as contagens das abas de situação seguem os outros filtros: o número bate com o que aparece
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
          <!-- pelo mês do torneio, o mesmo dos grupos: bate com o "R$ total" do grupo do mês -->
          <span class="rotulo-numero">{{ rotuloDosPremios(mes, mesAtual) }}</span>
          <strong class="numero-grande mono dinheiro">{{ formatarCentavos(premiosCalculados(torneios, mes)) }}</strong>
        </div>
      </section>

      <div class="controles">
          <div role="tablist" aria-label="Filtrar torneios" class="segmentos">
            <button
              v-for="f in FILTROS"
              :key="f.id"
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
            <!-- só visual: o grupo já tem o nome "Divisão" para o leitor de tela -->
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
      </div>

      <div id="lista-torneios" role="tabpanel" class="lista" aria-live="polite">
        <section v-if="grupos.emAndamento.length" class="grupo-andamento" aria-labelledby="t-em-andamento">
          <h2 id="t-em-andamento" class="titulo-do-grupo">Em andamento</h2>
          <CartaoDoTorneio v-for="t in grupos.emAndamento" :key="t.id" :torneio="t" />
        </section>

        <details v-for="g in grupos.meses" :key="g.mes" class="grupo-do-mes" :open="g.aberto">
          <summary>
            <span class="nome-do-mes">{{ g.rotulo }}</span>
            <span class="resumo-do-mes texto-suave">{{ g.resumo }}</span>
          </summary>
          <div class="torneios-do-mes">
            <CartaoDoTorneio v-for="t in g.torneios" :key="t.id" :torneio="t" />
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
/* os quatro filtros numa linha, que só quebra quando falta espaço */
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
/* a seta no lugar do triângulo padrão (que o display: flex esconde): aponta para baixo quando aberto */
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
  .busca {
    flex-basis: 100%;
    width: 100%;
  }
}
</style>
