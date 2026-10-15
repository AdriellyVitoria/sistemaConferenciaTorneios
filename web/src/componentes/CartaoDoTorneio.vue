<script setup lang="ts">
/**
 * Um torneio na lista da página inicial: nome, situação, criação, prêmio, divisão, partidas, o
 * próximo passo e, antes do cálculo, "Remover" (M2).
 */
import { RouterLink } from 'vue-router';
import RemoverTorneio from './RemoverTorneio.vue';
import { formatarCentavos } from '../dominio/dinheiro';
import { acaoDoTorneio, descreverPartidas } from '../dominio/lista-torneios';
import { formatarDataDeCriacao, rotuloDoModo, rotuloDoStatus } from '../dominio/torneio';
import type { ResumoTorneio, StatusTorneio } from '../servicos/api';

defineProps<{ torneio: ResumoTorneio }>();
const emit = defineEmits<{ removido: [] }>();

const tom: Record<StatusTorneio, string> = {
  criado: 'neutro',
  importado: 'info',
  conferindo: 'info',
  pronto: 'sucesso',
  calculado: 'sucesso',
};
</script>

<template>
  <article class="cartao torneio">
    <div class="dados">
      <div class="nome-e-situacao">
        <RouterLink :to="{ name: 'torneio', params: { id: torneio.id } }" class="nome">{{ torneio.nome }}</RouterLink>
        <span class="selo redondo" :class="tom[torneio.status]">{{ rotuloDoStatus(torneio.status) }}</span>
      </div>
      <div class="meta">
        <span>Criado em {{ formatarDataDeCriacao(torneio.criadoEm) }}</span>
        <strong class="mono premio">{{ formatarCentavos(torneio.premioCentavos) }}</strong>
        <span>{{ rotuloDoModo(torneio.modoDivisao) }}</span>
        <span>{{ descreverPartidas(torneio) }}</span>
      </div>
    </div>
    <div class="acoes">
      <!-- só antes do cálculo: depois, o resultado é o registro do pagamento, e o botão não existe -->
      <RemoverTorneio v-if="torneio.status !== 'calculado'" :torneio="torneio" rotulo="Remover" @removido="emit('removido')" />
      <RouterLink
        :to="{ name: 'torneio', params: { id: torneio.id } }"
        class="botao secundario acao"
        :aria-label="`${acaoDoTorneio(torneio.status)}: ${torneio.nome}`"
      >
        {{ acaoDoTorneio(torneio.status) }}
      </RouterLink>
    </div>
  </article>
</template>

<style scoped>
.torneio {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espaco-4) 28px;
  padding: 18px var(--espaco-5);
}
.dados {
  flex: 1 1 260px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.nome-e-situacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.nome {
  font-size: var(--texto-lg);
  font-weight: var(--peso-forte);
  color: var(--texto);
  text-decoration: none;
}
.nome:hover {
  color: var(--primaria);
  text-decoration: underline;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: var(--texto-sm);
  color: var(--texto-suave);
}
.premio {
  font-weight: var(--peso-medio);
  color: var(--texto);
}
.acoes {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: var(--espaco-2);
}
.acao {
  font-size: var(--texto-md);
  padding: 10px var(--espaco-4);
}
@media (max-width: 640px) {
  .acoes {
    margin-left: 0;
    width: 100%;
  }
  .acoes > * {
    flex: 1 1 0;
  }
}
</style>
