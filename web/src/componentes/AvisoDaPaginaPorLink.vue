<script setup lang="ts">
/**
 * O que as páginas abertas por link (pública e do time) mostram quando não dá para abrir.
 * Código errado ou vazio: "Página não encontrada", sem dizer se existe um torneio por trás. Outro
 * erro: pede para tentar de novo, para o jogador não achar que o link está errado.
 */
defineProps<{ tipo: 'nao_encontrada' | 'erro' }>();
</script>

<template>
  <section v-if="tipo === 'nao_encontrada'" class="cartao" aria-labelledby="t-nao-encontrada">
    <h1 id="t-nao-encontrada">Página não encontrada</h1>
    <p class="texto-medio">Confira se o link foi copiado inteiro.</p>
  </section>
  <section v-else class="cartao" aria-labelledby="t-erro">
    <h1 id="t-erro">Não foi possível carregar</h1>
    <p class="aviso alerta" role="alert">Não foi possível carregar a página agora. Tente de novo em alguns minutos.</p>
  </section>
</template>
