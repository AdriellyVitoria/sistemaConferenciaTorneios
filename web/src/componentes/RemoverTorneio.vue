<script setup lang="ts">
import { ref } from 'vue';
import DialogoConfirmacao from './DialogoConfirmacao.vue';
import { removerTorneio } from '../servicos/api';

const props = defineProps<{ torneio: { id: number; nome: string }; rotulo: string; discreto?: boolean }>();
const emit = defineEmits<{ removido: [] }>();

const aberto = ref(false);
const removendo = ref(false);
const erro = ref<string | null>(null);

function abrir() {
  erro.value = null;
  aberto.value = true;
}

async function confirmar() {
  if (removendo.value) return;
  removendo.value = true;
  try {
    const resultado = await removerTorneio(props.torneio.id);
    if (resultado.tipo === 'removido') {
      aberto.value = false;
      emit('removido');
    } else {
      erro.value = resultado.mensagem;
    }
  } finally {
    removendo.value = false;
  }
}
</script>

<template>
  <button
    type="button"
    :class="discreto ? 'botao-texto perigo-texto' : 'botao neutro remover'"
    :aria-label="discreto ? undefined : `Remover o torneio ${torneio.nome}`"
    @click="abrir"
  >
    {{ rotulo }}
  </button>
  <DialogoConfirmacao
    :aberto="aberto"
    :titulo="`Remover o torneio “${torneio.nome}”?`"
    texto-confirmar="Remover torneio"
    perigo
    @confirmar="confirmar"
    @cancelar="aberto = false"
  >
    <p>A planilha, a conferência e os Cientes serão apagados. Isso não pode ser desfeito.</p>
    <p v-if="erro" class="aviso erro" role="alert">{{ erro }}</p>
  </DialogoConfirmacao>
</template>

<style scoped>
.perigo-texto {
  color: var(--erro);
}
.remover {
  font-size: var(--texto-md);
  padding: 10px var(--espaco-4);
}
</style>
