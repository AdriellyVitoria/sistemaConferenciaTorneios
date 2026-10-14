<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { buscarSaude } from './servicos/api';

type Estado = 'verificando' | 'ok' | 'erro';

const api = ref<Estado>('verificando');
const banco = ref<Estado>('verificando');

async function verificar() {
  api.value = 'verificando';
  banco.value = 'verificando';
  try {
    const saude = await buscarSaude();
    api.value = 'ok';
    banco.value = saude.banco;
  } catch {
    api.value = 'erro';
    banco.value = 'erro';
  }
}

onMounted(verificar);

const rotulo: Record<Estado, string> = { verificando: 'verificando…', ok: 'ok', erro: 'fora do ar' };
</script>

<template>
  <main>
    <h1>Premiação de Torneios</h1>
    <p>Conferência das partidas no site oficial e divisão do prêmio entre os jogadores.</p>

    <section class="saude">
      <h2>Status do sistema</h2>
      <ul>
        <li :class="api">API: {{ rotulo[api] }}</li>
        <li :class="banco">Banco de dados: {{ rotulo[banco] }}</li>
      </ul>
      <button type="button" @click="verificar">Verificar de novo</button>
    </section>
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #1f2933;
  background: #f5f7fa;
}
main {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 16px;
}
.saude ul {
  list-style: none;
  padding: 0;
}
.saude li {
  padding: 8px 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  background: #e4e7eb;
}
.saude li.ok {
  background: #d1f2dc;
}
.saude li.erro {
  background: #fbd5d5;
}
</style>
