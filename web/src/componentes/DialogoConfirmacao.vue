<script setup lang="ts">
import { ref, watch } from 'vue';

/**
 * Pergunta antes de uma ação que não se desfaz (substituir a planilha, calcular).
 * Usa o <dialog> do navegador: prende o foco dentro dele e fecha com Esc.
 */
const props = defineProps<{
  aberto: boolean;
  titulo: string;
  textoConfirmar: string;
  perigo?: boolean;
}>();
const emit = defineEmits<{ confirmar: []; cancelar: [] }>();

const dialogo = ref<HTMLDialogElement | null>(null);

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto && !dialogo.value?.open) dialogo.value?.showModal();
    if (!aberto && dialogo.value?.open) dialogo.value.close();
  },
);
</script>

<template>
  <dialog ref="dialogo" class="dialogo" aria-labelledby="titulo-dialogo" @cancel.prevent="emit('cancelar')">
    <h2 id="titulo-dialogo">{{ titulo }}</h2>
    <div class="corpo"><slot /></div>
    <div class="acoes">
      <button type="button" class="botao secundario" autofocus @click="emit('cancelar')">Cancelar</button>
      <button type="button" class="botao" :class="{ perigo }" @click="emit('confirmar')">{{ textoConfirmar }}</button>
    </div>
  </dialog>
</template>

<style scoped>
.dialogo {
  border: none;
  border-radius: var(--raio-dialogo);
  padding: var(--espaco-6);
  max-width: 520px;
  width: calc(100% - 2 * var(--espaco-4));
  box-shadow: var(--sombra-dialogo);
  color: var(--texto);
  display: flex;
  flex-direction: column;
  gap: var(--espaco-4);
}
.dialogo:not([open]) {
  display: none;
}
.dialogo::backdrop {
  background: var(--fundo-modal);
}
.corpo {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--texto-medio);
}
.acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--espaco-3);
}
</style>
