<script setup lang="ts">
/**
 * "Remover" um torneio ainda não calculado (M2, plano item 9), com o modal de confirmação: o nome,
 * o que será apagado e que não pode ser desfeito. O foco começa no "Cancelar" (DialogoConfirmacao).
 * Quem decide se o botão aparece é a tela: depois do cálculo, ele não existe.
 *
 * `discreto`: o botão do topo da página do torneio, em texto, para não competir com as ações da
 * conferência; no cartão da lista, um botão secundário.
 */
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
  // a trava antes de qualquer espera: dois cliques no mesmo instante geram um pedido só
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
