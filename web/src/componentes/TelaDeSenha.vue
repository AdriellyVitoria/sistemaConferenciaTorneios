<script setup lang="ts">
import { onMounted, ref, useId } from 'vue';
import { entrar } from '../servicos/api';

const senha = ref('');
const erro = ref<string | null>(null);
const entrando = ref(false);
const campo = ref<HTMLInputElement | null>(null);
const idDoCampo = `senha-${useId()}`;
const idDoErro = `erro-senha-${useId()}`;

onMounted(() => campo.value?.focus());

async function enviar() {
  if (entrando.value) return;
  if (senha.value === '') {
    erro.value = 'Digite a senha.';
    campo.value?.focus();
    return;
  }
  entrando.value = true;
  erro.value = null;
  const resultado = await entrar(senha.value);
  entrando.value = false;
  if (resultado.tipo === 'ok') return;
  erro.value = resultado.tipo === 'incorreta' ? 'Senha incorreta. Confira e tente de novo.' : resultado.mensagem;
  campo.value?.select();
}
</script>

<template>
  <main class="pagina estreita">
    <section class="cartao" aria-labelledby="t-senha">
      <div class="titulo-da-pagina">
        <h1 id="t-senha">Senha da organizadora</h1>
        <p class="texto-suave">Estas telas são só da organizadora. A página pública e o link de cada time não pedem senha.</p>
      </div>
      <form class="formulario" novalidate @submit.prevent="enviar">
        <div class="grupo">
          <label class="rotulo" :for="idDoCampo">Senha</label>
          <input
            :id="idDoCampo"
            ref="campo"
            v-model="senha"
            type="password"
            class="campo"
            autocomplete="current-password"
            :aria-invalid="erro ? 'true' : undefined"
            :aria-describedby="erro ? idDoErro : undefined"
          />
          <span v-if="erro" :id="idDoErro" class="mensagem-erro" role="alert">{{ erro }}</span>
        </div>
        <div>
          <button type="submit" class="botao" :disabled="entrando">Entrar</button>
        </div>
      </form>
    </section>
  </main>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: var(--espaco-4);
}
</style>
