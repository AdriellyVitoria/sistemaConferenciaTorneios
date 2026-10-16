<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId } from 'vue';
import { RouterLink } from 'vue-router';
import AvisoDaPaginaPorLink from '../componentes/AvisoDaPaginaPorLink.vue';
import { formatarCentavos } from '../dominio/dinheiro';
import { contaDoJogador, filtrarPorNick, passosDoCalculo } from '../dominio/link-do-time';
import { buscarPaginaDoTime, type LeituraPorLink, type PaginaDoTime } from '../servicos/api';

const props = defineProps<{ codigo: string }>();

const estado = ref<{ tipo: 'carregando' } | LeituraPorLink<PaginaDoTime>>({ tipo: 'carregando' });

const tituloOriginal = document.title;
onMounted(async () => {
  estado.value = props.codigo ? await buscarPaginaDoTime(props.codigo) : { tipo: 'nao_encontrada' };
  if (estado.value.tipo === 'ok') document.title = `Prêmio do time ${estado.value.pagina.time.nome}`;
});
onUnmounted(() => {
  document.title = tituloOriginal;
});

const pagina = computed(() => (estado.value.tipo === 'ok' ? estado.value.pagina : null));
const passos = computed(() => (pagina.value ? passosDoCalculo(pagina.value) : []));

const busca = ref('');
const idDaBusca = `nick-time-${useId()}`;
const encontrados = computed(() => filtrarPorNick(pagina.value?.jogadores ?? [], busca.value));
const resumo = computed(() => {
  const total = pagina.value?.jogadores.length ?? 0;
  const palavra = total === 1 ? 'jogador' : 'jogadores';
  return busca.value.trim() ? `${encontrados.value.length} de ${total} ${palavra}` : `${total} ${palavra}`;
});
const rotuloDaBase = computed(() => (pagina.value?.time.baseUsada === 'kills' ? 'Kills do time' : 'Minutos jogados pelo time'));
</script>

<template>
  <main class="pagina estreita">
    <p v-if="estado.tipo === 'carregando'" class="texto-suave">Carregando o prêmio do time…</p>

    <AvisoDaPaginaPorLink v-else-if="estado.tipo === 'nao_encontrada' || estado.tipo === 'erro'" :tipo="estado.tipo" />

    <template v-else-if="pagina">
      <div class="titulo-da-pagina">
        <span class="texto-suave sobretitulo">{{ pagina.torneio.nome }} · link do time</span>
        <h1>{{ pagina.time.nome }}</h1>
      </div>

      <section class="resumo" aria-label="Resumo do time">
        <div><span>Colocação</span><strong>{{ pagina.time.posicao }}º lugar</strong></div>
        <div><span>Prêmio do time</span><strong class="mono">{{ formatarCentavos(pagina.time.premioCentavos) }}</strong></div>
        <div><span>{{ rotuloDaBase }}</span><strong class="mono">{{ pagina.time.baseTime }}</strong></div>
      </section>

      <section class="cartao" aria-labelledby="t-como">
        <h2 id="t-como">Como o valor foi calculado</h2>
        <ol class="passos">
          <li v-for="passo in passos" :key="passo">{{ passo }}</li>
        </ol>
      </section>

      <section class="cartao" aria-labelledby="t-jogadores">
        <div class="titulo-com-acao">
          <h2 id="t-jogadores">Valor de cada jogador</h2>
          <div class="grupo busca">
            <label :for="idDaBusca" class="ajuda">Procurar meu nick</label>
            <input :id="idDaBusca" v-model="busca" type="search" class="campo" placeholder="Ex.: Tuca" autocomplete="off" />
          </div>
        </div>

        <ul class="jogadores">
          <li v-for="j in encontrados" :key="j.nick" class="cartao-jogador" :class="{ com_centavo: j.recebeuCentavo }">
            <div class="linha">
              <strong class="nick">{{ j.nick }}</strong>
              <span class="mono valor">{{ formatarCentavos(j.premioCentavos) }}</span>
            </div>
            <span class="conta">{{ contaDoJogador(j, pagina.time) }}</span>
            <span v-if="j.recebeuCentavo" class="observacao">Recebeu R$ 0,01 de arredondamento: era o jogador do time mais perto de receber o centavo que sobrou.</span>
            <span v-if="j.explicacao" class="observacao">{{ j.explicacao }}</span>
          </li>
        </ul>
        <p v-if="!encontrados.length" class="texto-medio">Nenhum jogador com esse nick neste time.</p>
        <p class="resumo-jogadores texto-suave" aria-live="polite">{{ resumo }}</p>

        <div class="total-do-time"><span>Total do time</span><span class="mono">{{ formatarCentavos(pagina.totalCentavos) }}</span></div>
      </section>

      <p class="rodape-do-time texto-suave">
        {{ pagina.time.baseUsada === 'kills' ? 'As kills vêm' : 'Os minutos vêm' }} do registro oficial de cada partida.
        <RouterLink :to="{ name: 'publico', params: { codigo: pagina.codigoPublico } }">Ver a classificação completa do torneio</RouterLink>
      </p>
    </template>
  </main>
</template>

<style scoped>
.sobretitulo {
  font-size: var(--texto-sm);
}
.resumo {
  background: var(--cabecalho);
  color: var(--cabecalho-texto);
  border-radius: var(--raio-grande);
  padding: var(--espaco-5);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--espaco-4);
}
.resumo div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.resumo span {
  font-size: var(--texto-sm);
  color: var(--cabecalho-texto-suave);
}
.resumo strong {
  font-size: 24px;
  font-weight: var(--peso-forte);
}
.resumo strong.mono {
  font-weight: var(--peso-medio);
}
.passos {
  margin: 0;
  padding-left: var(--espaco-5);
  display: flex;
  flex-direction: column;
  gap: var(--espaco-2);
  color: var(--texto-medio);
}
.busca {
  flex: 0 1 240px;
  gap: var(--espaco-1);
}
.jogadores {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espaco-3);
}
.cartao-jogador {
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  padding: var(--espaco-3) var(--espaco-4);
  display: flex;
  flex-direction: column;
  gap: var(--espaco-1);
}
.cartao-jogador.com_centavo {
  border-color: var(--alerta-fundo);
  background: var(--superficie-suave);
}
.linha {
  display: flex;
  justify-content: space-between;
  gap: var(--espaco-2);
}
.nick {
  font-weight: var(--peso-forte);
  min-width: 0;
  overflow-wrap: anywhere;
}
.valor {
  font-weight: var(--peso-medio);
  white-space: nowrap;
}
.conta {
  font-size: var(--texto-sm);
  color: var(--texto-suave);
}
.observacao {
  font-size: var(--texto-sm);
  color: var(--alerta);
}
.total-do-time {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--borda);
  padding-top: var(--espaco-3);
  font-weight: var(--peso-forte);
}
.rodape-do-time {
  margin: 0;
  font-size: var(--texto-sm);
}
@media (max-width: 640px) {
  .busca {
    flex-basis: 100%;
  }
}
</style>
