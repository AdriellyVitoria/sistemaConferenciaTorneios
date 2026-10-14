<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { buscarSaude } from './servicos/api';

// O rodapé mostra se a API e o banco estão no ar (o que a página inicial da etapa 0 fazia).
type Estado = 'verificando' | 'ok' | 'erro';
const api = ref<Estado>('verificando');
const banco = ref<Estado>('verificando');

onMounted(async () => {
  try {
    const saude = await buscarSaude();
    api.value = 'ok';
    banco.value = saude.banco;
  } catch {
    api.value = 'erro';
    banco.value = 'erro';
  }
});

const rotulo: Record<Estado, string> = { verificando: 'verificando…', ok: 'no ar', erro: 'fora do ar' };
</script>

<template>
  <header class="cabecalho">
    <RouterLink to="/" class="marca">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
      </svg>
      <span>Premiação de torneios</span>
    </RouterLink>
    <nav>
      <RouterLink to="/">Torneios</RouterLink>
    </nav>
  </header>

  <RouterView />

  <footer class="rodape">
    <span :class="api">API {{ rotulo[api] }}</span>
    <span aria-hidden="true">·</span>
    <span :class="banco">Banco de dados {{ rotulo[banco] }}</span>
  </footer>
</template>

<style scoped>
.cabecalho {
  background: var(--cabecalho);
  color: #ffffff;
  padding: 14px 24px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.marca {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 16px;
  color: #ffffff;
  text-decoration: none;
}
.marca:hover {
  color: #ffffff;
}
.marca svg {
  color: var(--cabecalho-icone);
}
nav a {
  color: var(--cabecalho-texto-suave);
  font-size: 14px;
  text-decoration: none;
}
nav a:hover,
nav a.router-link-exact-active {
  color: #ffffff;
}
.rodape {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px 32px;
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: var(--texto-suave);
}
.rodape .erro {
  color: var(--erro);
}
</style>
