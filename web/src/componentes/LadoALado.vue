<script setup lang="ts">
import { rotuloDoValor, valorDoLado } from '../dominio/pendencias';
import type { Pendencia } from '../servicos/api';

withDefaults(defineProps<{ pendencia: Pendencia; tituloDoSite?: string }>(), {
  tituloDoSite: 'No site oficial · usado no cálculo',
});
</script>

<template>
  <div class="lado-a-lado">
    <div class="lado planilha">
      <span class="titulo-lado">Na planilha</span>
      <div class="linha-valor"><span>{{ rotuloDoValor(pendencia) }}</span><span class="mono">{{ valorDoLado(pendencia, 'planilha') }}</span></div>
    </div>
    <div class="lado site">
      <span class="titulo-lado">{{ tituloDoSite }}</span>
      <div class="linha-valor"><span>{{ rotuloDoValor(pendencia) }}</span><span class="mono">{{ valorDoLado(pendencia, 'site') }}</span></div>
    </div>
  </div>
</template>

<style scoped>
.lado-a-lado {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: var(--espaco-3);
}
.lado {
  border-radius: var(--raio);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.lado.planilha {
  background: var(--superficie-suave);
}
.lado.site {
  background: var(--primaria-clara);
}
.titulo-lado {
  font-size: var(--texto-xs);
  font-weight: var(--peso-forte);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--texto-suave);
}
.lado.site .titulo-lado {
  color: var(--primaria-escura);
}
.linha-valor {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--espaco-1) var(--espaco-3);
}
.linha-valor > span:first-child {
  flex: 0 0 auto;
  overflow-wrap: normal;
}
.linha-valor .mono {
  flex: 1 1 12ch;
  min-width: 0;
  text-align: right;
}
</style>
