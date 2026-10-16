<script setup lang="ts">
import { computed } from 'vue';
import { formatarCentavos } from '../dominio/dinheiro';
import { descreverPosicoesPremiadas, explicarEmpates, rotuloDoCriterio } from '../dominio/resultado';
import type { TimeDaClassificacao } from '../servicos/api';

const props = defineProps<{ times: TimeDaClassificacao[]; percentuais: number[]; idDoTitulo: string }>();

const empates = computed(() => explicarEmpates(props.times, props.percentuais));
</script>

<template>
  <div class="cabecalho-classificacao">
    <h2 :id="idDoTitulo">Classificação</h2>
    <p class="texto-suave">{{ descreverPosicoesPremiadas(percentuais) }}</p>
  </div>
  <div class="caixa-tabela">
    <table class="tabela-resultado">
      <caption class="visualmente-oculto">Classificação</caption>
      <thead>
        <tr>
          <th scope="col">Posição</th>
          <th scope="col">Time</th>
          <th scope="col" class="numero">Prêmio</th>
          <th scope="col" class="numero">Vitórias</th>
          <th scope="col" class="numero">Kills do time</th>
          <th scope="col">Critério</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in times" :key="t.time" :class="{ sem_premio: t.premioCentavos === 0 }">
          <th scope="row" class="forte">{{ t.posicao }}º</th>
          <td class="forte">{{ t.time }}</td>
          <td class="numero mono">
            <template v-if="t.premioCentavos > 0">{{ formatarCentavos(t.premioCentavos) }}</template>
            <template v-else><span aria-hidden="true">—</span><span class="visualmente-oculto">sem prêmio</span></template>
          </td>
          <td class="numero numeral">{{ t.vitorias }}</td>
          <td class="numero numeral">{{ t.killsTime }}</td>
          <td>
            <span v-if="rotuloDoCriterio(t.criterio)" class="selo" :class="rotuloDoCriterio(t.criterio)!.tom">{{ rotuloDoCriterio(t.criterio)!.texto }}</span>
            <span v-else>—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-for="frase in empates" :key="frase" class="quadro-suave">{{ frase }}</p>
</template>

<style scoped>
.cabecalho-classificacao {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--espaco-2) var(--espaco-4);
}
.cabecalho-classificacao p {
  margin: 0;
  font-size: var(--texto-sm);
  text-align: right;
}
@media (max-width: 640px) {
  .cabecalho-classificacao {
    flex-direction: column;
    align-items: flex-start;
  }
  .cabecalho-classificacao p {
    text-align: left;
  }
}
</style>
