<script setup lang="ts">
/**
 * A página pública do torneio (7c, D11), aberta pelo link que a Maria divulga para os jogadores.
 * Mostra só o que a API manda em GET /publico/:codigo: nome, data do cálculo, as regras em texto
 * simples e a classificação com a frase dos empates. Nenhum dado de jogador, e nenhum link para as
 * telas da Maria (a rota é marcada como pública e o App esconde o menu e o rodapé).
 *
 * Código errado ou vazio: "Página não encontrada", sem dizer se o torneio existe.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import TabelaClassificacao from '../componentes/TabelaClassificacao.vue';
import { regrasEmTexto } from '../dominio/publico';
import { formatarDataDeCriacao } from '../dominio/torneio';
import { buscarPaginaPublica, type PaginaPublica } from '../servicos/api';

const props = defineProps<{ codigo: string }>();

type Estado = { tipo: 'carregando' } | { tipo: 'ok'; pagina: PaginaPublica } | { tipo: 'nao_encontrada' } | { tipo: 'erro' };
const estado = ref<Estado>({ tipo: 'carregando' });

const tituloOriginal = document.title;
onMounted(async () => {
  // sem código, nem pergunta à API
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

    <section v-else-if="estado.tipo === 'nao_encontrada'" class="cartao" aria-labelledby="t-nao-encontrada">
      <h1 id="t-nao-encontrada">Página não encontrada</h1>
      <p class="texto-medio">Confira se o link foi copiado inteiro.</p>
    </section>

    <section v-else-if="estado.tipo === 'erro'" class="cartao" aria-labelledby="t-erro">
      <h1 id="t-erro">Não foi possível carregar</h1>
      <p class="aviso alerta" role="alert">Não foi possível carregar a página agora. Tente de novo em alguns minutos.</p>
    </section>

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
