<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AvisoDaPaginaPorLink from '../componentes/AvisoDaPaginaPorLink.vue';
import TabelaClassificacao from '../componentes/TabelaClassificacao.vue';
import { regrasEmTexto } from '../dominio/publico';
import { formatarDataDeCriacao } from '../dominio/torneio';
import { buscarPaginaPublica, type LeituraPorLink, type PaginaPublica } from '../servicos/api';

const props = defineProps<{ codigo: string }>();

type Estado = { tipo: 'carregando' } | LeituraPorLink<PaginaPublica>;
const estado = ref<Estado>({ tipo: 'carregando' });

const tituloOriginal = document.title;
onMounted(async () => {
  estado.value = props.codigo ? await buscarPaginaPublica(props.codigo) : { tipo: 'nao_encontrada' };
  if (estado.value.tipo === 'ok') document.title = `${estado.value.pagina.torneio.nome} · Classificação`;
});
onUnmounted(() => {
  document.title = tituloOriginal;
});

const pagina = computed(() => (estado.value.tipo === 'ok' ? estado.value.pagina : null));
const regras = computed(() => (pagina.value ? regrasEmTexto(pagina.value.regras, pagina.value.classificacao.length) : []));
</script>

<template>
  <main class="pagina">
    <p v-if="estado.tipo === 'carregando'" class="texto-suave">Carregando a classificação…</p>

    <AvisoDaPaginaPorLink v-else-if="estado.tipo === 'nao_encontrada' || estado.tipo === 'erro'" :tipo="estado.tipo" />

    <template v-else-if="pagina">
      <div class="titulo-da-pagina">
        <h1>{{ pagina.torneio.nome }}</h1>
        <p class="texto-suave">Calculado em {{ formatarDataDeCriacao(pagina.calculadoEm) }}</p>
      </div>

      <section class="cartao" aria-labelledby="t-regras">
        <h2 id="t-regras">Como o prêmio foi dividido</h2>
        <dl class="regras">
          <div v-for="r in regras" :key="r.rotulo">
            <dt>{{ r.rotulo }}</dt>
            <dd>{{ r.texto }}</dd>
          </div>
        </dl>
      </section>

      <section class="cartao" aria-labelledby="t-classificacao">
        <TabelaClassificacao :times="pagina.classificacao" :percentuais="pagina.regras.percentuais" id-do-titulo="t-classificacao" />
      </section>
    </template>
  </main>
</template>

<style scoped>
.regras {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espaco-3);
}
.regras div {
  display: grid;
  grid-template-columns: minmax(150px, 200px) 1fr;
  gap: var(--espaco-1) var(--espaco-4);
}
.regras dt {
  font-weight: var(--peso-medio);
  color: var(--texto-suave);
  font-size: var(--texto-sm);
}
.regras dd {
  margin: 0;
  color: var(--texto-medio);
  min-width: 0;
}
@media (max-width: 640px) {
  .regras div {
    grid-template-columns: 1fr;
  }
}
</style>
