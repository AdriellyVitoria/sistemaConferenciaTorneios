<script setup lang="ts">
/** A tela do resultado é da etapa 6e; por enquanto, só o caminho até ela existe. */
import { RouterLink } from 'vue-router';

defineProps<{ id: number }>();
</script>

<template>
  <main class="pagina estreita">
    <div class="titulo-da-pagina">
      <div class="trilha">
        <RouterLink to="/">Torneios</RouterLink> /
        <RouterLink :to="{ name: 'torneio', params: { id } }">Torneio</RouterLink> / Resultado
      </div>
      <h1>Resultado</h1>
    </div>
    <section class="cartao">
      <p class="texto-medio">Em construção: a tela do resultado, com o filtro por nick, chega na próxima etapa.</p>
      <p class="texto-suave">Enquanto isso, o CSV para pagar está em <a :href="`/api/torneios/${id}/resultado.csv`">baixar o resultado</a>.</p>
    </section>
  </main>
</template>
