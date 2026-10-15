<script setup lang="ts">
/**
 * "Pronto para calcular" (5e), no topo da página do torneio: diz o que falta, com as contagens, e
 * cada item leva para a aba onde se resolve. O botão "Calcular" é da etapa 6.
 */
import { computed } from 'vue';
import { avisoDoCalculo, type AbaDoTorneio } from '../dominio/calculo';
import type { SituacaoDoCalculo } from '../servicos/api';

const props = defineProps<{ calculo: SituacaoDoCalculo }>();
const emit = defineEmits<{ irPara: [aba: AbaDoTorneio] }>();

const aviso = computed(() => avisoDoCalculo(props.calculo));
const TOM: Record<string, string> = { sem_planilha: 'neutro', faltando: 'alerta', pronto: 'sucesso', calculado: 'sucesso' };
</script>

<template>
  <section class="aviso-calculo" :class="TOM[aviso.estado]" aria-label="Situação do cálculo" aria-live="polite">
    <svg v-if="aviso.estado === 'pronto' || aviso.estado === 'calculado'" class="icone" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
    <strong>{{ aviso.texto }}</strong>
    <ul v-if="aviso.itens.length" class="itens">
      <li v-for="item in aviso.itens" :key="item.texto">
        <button type="button" class="item" @click="emit('irPara', item.aba)">{{ item.texto }}</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.aviso-calculo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espaco-2) var(--espaco-3);
  border-radius: var(--raio-grande);
  padding: var(--espaco-3) var(--espaco-5);
  border: 1px solid transparent;
}
.aviso-calculo.neutro {
  background: var(--superficie);
  border-color: var(--borda);
  color: var(--texto-medio);
}
.aviso-calculo.alerta {
  background: var(--alerta-fundo);
  color: var(--alerta);
}
.aviso-calculo.sucesso {
  background: var(--sucesso-fundo);
  color: var(--sucesso);
}
.icone {
  flex-shrink: 0;
}
.itens {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--espaco-2);
}
/* cada item é um botão que leva à aba; com cara de etiqueta, mas alvo de toque inteiro */
.item {
  font: inherit;
  font-size: var(--texto-md);
  font-weight: var(--peso-medio);
  font-variant-numeric: tabular-nums;
  min-height: var(--alvo-toque);
  padding: var(--espaco-2) var(--espaco-3);
  border-radius: var(--raio-pilula);
  border: 1px solid currentColor;
  background: var(--superficie);
  color: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.item:hover {
  background: var(--superficie-suave);
}
@media (max-width: 640px) {
  .aviso-calculo {
    padding: var(--espaco-3) var(--espaco-4);
  }
}
</style>
