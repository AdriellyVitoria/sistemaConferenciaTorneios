<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { formatarCentavos } from '../dominio/dinheiro';
import { rotuloDoModo, rotuloDoStatus } from '../dominio/torneio';
import { listarTorneios, type ResumoTorneio, type StatusTorneio } from '../servicos/api';

const torneios = ref<ResumoTorneio[] | null>(null);
const erro = ref<string | null>(null);

onMounted(async () => {
  try {
    torneios.value = await listarTorneios();
  } catch (e) {
    erro.value = (e as Error).message;
  }
});

const tom: Record<StatusTorneio, string> = {
  criado: 'neutro',
  importado: 'info',
  conferindo: 'alerta',
  pronto: 'sucesso',
  calculado: 'sucesso',
};
</script>

<template>
  <main class="pagina">
    <div class="titulo-com-acao">
      <div class="titulo-da-pagina">
        <h1>Torneios</h1>
        <p class="texto-suave">Crie o torneio, suba a planilha e o sistema confere cada partida no site oficial.</p>
      </div>
      <RouterLink :to="{ name: 'novo-torneio' }" class="botao">Novo torneio</RouterLink>
    </div>

    <p v-if="erro" class="aviso erro" role="alert">{{ erro }}</p>
    <p v-else-if="torneios === null" class="texto-suave">Carregando os torneios…</p>

    <section v-else-if="torneios.length === 0" class="cartao vazio">
      <h2>Nenhum torneio ainda</h2>
      <p class="texto-medio">Comece criando o torneio: nome, prêmio, percentuais de cada posição e a forma de divisão entre os jogadores.</p>
      <div><RouterLink :to="{ name: 'novo-torneio' }" class="botao">Criar o primeiro torneio</RouterLink></div>
    </section>

    <section v-else class="cartao" aria-label="Lista de torneios">
      <div class="rolagem">
        <table class="tabela">
          <thead>
            <tr>
              <th>Torneio</th>
              <th class="numero">Prêmio</th>
              <th>Divisão</th>
              <th class="numero">Partidas</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in torneios" :key="t.id">
              <td>
                <RouterLink :to="{ name: 'torneio', params: { id: t.id } }" class="nome">{{ t.nome }}</RouterLink>
              </td>
              <td class="numero">{{ formatarCentavos(t.premioCentavos) }}</td>
              <td class="texto-medio">{{ rotuloDoModo(t.modoDivisao) }}</td>
              <td class="numero">{{ t.quantidadeDePartidas }}</td>
              <td><span class="selo" :class="tom[t.status]">{{ rotuloDoStatus(t.status) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.tabela {
  min-width: 640px;
}
.nome {
  font-weight: 600;
}
.vazio {
  align-items: flex-start;
}
</style>
