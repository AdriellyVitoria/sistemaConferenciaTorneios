<script setup lang="ts">
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
