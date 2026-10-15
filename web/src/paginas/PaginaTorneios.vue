<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { formatarCentavos } from '../dominio/dinheiro';
import {
  acaoDoTorneio,
  contarPorFiltro,
  descreverPartidas,
  filtrarTorneios,
  premiosCalculados,
  type Filtro,
} from '../dominio/lista-torneios';
import { formatarDataDeCriacao, rotuloDoModo, rotuloDoStatus } from '../dominio/torneio';
import { listarTorneios, type ResumoTorneio, type StatusTorneio } from '../servicos/api';

const torneios = ref<ResumoTorneio[] | null>(null);
const erro = ref<string | null>(null);

onMounted(async () => {
  try {
    torneios.value = await listarTorneios();
  } catch (e) {
    erro.value = (e as Error).message;
  }
});

const filtro = ref<Filtro>('todos');
const busca = ref('');
const visiveis = computed(() => filtrarTorneios(torneios.value ?? [], filtro.value, busca.value));
const contagem = computed(() => contarPorFiltro(torneios.value ?? []));

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'andamento', rotulo: 'Em andamento' },
  { id: 'calculados', rotulo: 'Calculados' },
];

const tom: Record<StatusTorneio, string> = {
  criado: 'neutro',
  importado: 'info',
  conferindo: 'info',
  pronto: 'sucesso',
  calculado: 'sucesso',
};
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
          <strong class="numero-grande numeral">{{ contagem.andamento }}</strong>
        </div>
        <div class="cartao-numero">
          <span class="rotulo-numero">Prêmios calculados</span>
          <strong class="numero-grande mono dinheiro">{{ formatarCentavos(premiosCalculados(torneios)) }}</strong>
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
        <div class="grupo busca">
          <label for="busca-torneio" class="ajuda">Buscar torneio</label>
          <input id="busca-torneio" v-model="busca" type="search" class="campo" placeholder="Nome do torneio" autocomplete="off" />
        </div>
      </div>

      <div id="lista-torneios" role="tabpanel" class="lista" aria-live="polite">
        <article v-for="t in visiveis" :key="t.id" class="cartao torneio">
          <div class="dados">
            <div class="nome-e-situacao">
              <RouterLink :to="{ name: 'torneio', params: { id: t.id } }" class="nome">{{ t.nome }}</RouterLink>
              <span class="selo redondo" :class="tom[t.status]">{{ rotuloDoStatus(t.status) }}</span>
            </div>
            <div class="meta">
              <span>Criado em {{ formatarDataDeCriacao(t.criadoEm) }}</span>
              <strong class="mono premio">{{ formatarCentavos(t.premioCentavos) }}</strong>
              <span>{{ rotuloDoModo(t.modoDivisao) }}</span>
              <span>{{ descreverPartidas(t) }}</span>
            </div>
          </div>
          <RouterLink
            :to="{ name: 'torneio', params: { id: t.id } }"
            class="botao secundario acao"
            :aria-label="`${acaoDoTorneio(t.status)}: ${t.nome}`"
          >
            {{ acaoDoTorneio(t.status) }}
          </RouterLink>
        </article>
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
  justify-content: space-between;
  gap: var(--espaco-3);
}
.busca {
  flex: 0 1 280px;
  gap: 2px;
}
.lista {
  display: flex;
  flex-direction: column;
  gap: var(--espaco-3);
}
.torneio {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espaco-4) 28px;
  padding: 18px var(--espaco-5);
}
.dados {
  flex: 1 1 260px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.nome-e-situacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.nome {
  font-size: var(--texto-lg);
  font-weight: var(--peso-forte);
  color: var(--texto);
  text-decoration: none;
}
.nome:hover {
  color: var(--primaria);
  text-decoration: underline;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: var(--texto-sm);
  color: var(--texto-suave);
}
.premio {
  font-weight: var(--peso-medio);
  color: var(--texto);
}
.acao {
  margin-left: auto;
  font-size: var(--texto-md);
  padding: 10px var(--espaco-4);
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
  .busca {
    flex-basis: 100%;
  }
  .acao {
    margin-left: 0;
    width: 100%;
  }
}
</style>
