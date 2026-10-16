<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import TelaDeSenha from './componentes/TelaDeSenha.vue';
import { buscarSaude } from './servicos/api';
import { pedeSenha, sair, temSenha } from './servicos/sessao';

const rota = useRoute();
const roteador = useRouter();
const publica = computed(() => rota.meta.publica === true);
const mostrarSenha = computed(() => !publica.value && pedeSenha.value);

type Estado = 'verificando' | 'ok' | 'erro';
const api = ref<Estado>('verificando');
const banco = ref<Estado>('verificando');

onMounted(async () => {
  await roteador.isReady();
  if (publica.value) return;
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
    <component :is="publica ? 'span' : RouterLink" v-bind="publica ? {} : { to: '/' }" class="marca">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
      </svg>
      <span>Premiação de torneios</span>
    </component>
    <nav v-if="!publica">
      <RouterLink v-if="!mostrarSenha" to="/">Torneios</RouterLink>
      <button v-if="temSenha" type="button" class="sair" @click="sair">Sair</button>
    </nav>
  </header>

  <TelaDeSenha v-if="mostrarSenha" />
  <RouterView v-else />

  <footer v-if="!publica" class="rodape">
    <span :class="api">API {{ rotulo[api] }}</span>
    <span aria-hidden="true">·</span>
    <span :class="banco">Banco de dados {{ rotulo[banco] }}</span>
  </footer>
</template>

<style scoped>
.cabecalho {
  background: var(--cabecalho);
  color: var(--cabecalho-texto);
  padding: 14px var(--margem-lateral);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--espaco-3);
}
.marca {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: var(--peso-forte);
  font-size: var(--texto-marca);
  min-height: var(--alvo-toque);
  color: var(--cabecalho-texto);
  text-decoration: none;
}
.marca:hover {
  color: var(--cabecalho-texto);
}
.marca svg {
  color: var(--cabecalho-icone);
}
nav a {
  display: inline-flex;
  align-items: center;
  min-height: var(--alvo-toque);
  color: var(--cabecalho-texto-suave);
  font-size: var(--texto-md);
  text-decoration: none;
}
nav {
  display: flex;
  align-items: center;
  gap: var(--espaco-4);
}
nav a:hover,
nav a.router-link-exact-active {
  color: var(--cabecalho-texto);
}
.sair {
  min-height: var(--alvo-toque);
  padding: 0;
  background: none;
  border: none;
  color: var(--cabecalho-texto-suave);
  font: inherit;
  font-size: var(--texto-md);
  cursor: pointer;
}
.sair:hover {
  color: var(--cabecalho-texto);
}
.sair:focus-visible {
  outline: 2px solid var(--cabecalho-texto);
  outline-offset: 2px;
}
.rodape {
  max-width: var(--largura-pagina);
  margin: 0 auto;
  padding: 0 var(--margem-lateral) var(--espaco-7);
  display: flex;
  gap: var(--espaco-2);
  font-size: var(--texto-sm);
  color: var(--texto-suave);
}
.rodape .erro {
  color: var(--erro);
}
</style>
