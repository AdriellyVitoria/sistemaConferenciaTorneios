<script setup lang="ts">
/**
 * A classificação gravada no cálculo, com as posições empatadas (1, 2, 3, 3, 5), o prêmio do time
 * e o critério como selo, e as frases dos empates montadas dos dados (D2). Usada na tela do
 * resultado (6e) e na página pública (7c): as duas mostram a mesma classificação do mesmo jeito.
 */
import { computed } from 'vue';
import { formatarCentavos } from '../dominio/dinheiro';
import { explicarEmpates, rotuloDoCriterio } from '../dominio/resultado';
import type { TimeDaClassificacao } from '../servicos/api';

const props = defineProps<{ times: TimeDaClassificacao[]; percentuais: number[] }>();

const empates = computed(() => explicarEmpates(props.times, props.percentuais));
</script>

<template>
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
          <!-- o prêmio logo depois do time: no celular, é o que aparece antes de arrastar a tabela -->
          <td class="numero mono">
            <template v-if="t.premioCentavos > 0">{{ formatarCentavos(t.premioCentavos) }}</template>
            <!-- o leitor de tela diria "travessão"; ele lê "sem prêmio" -->
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
