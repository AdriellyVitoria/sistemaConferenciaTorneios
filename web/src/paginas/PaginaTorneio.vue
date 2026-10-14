<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import DialogoConfirmacao from '../componentes/DialogoConfirmacao.vue';
import { formatarCentavos } from '../dominio/dinheiro';
import { resumoDosPercentuais } from '../dominio/percentuais';
import {
  envioDaPlanilha,
  formatarData,
  linhasDoErro,
  rotuloDaConferencia,
  rotuloDoModo,
  rotuloDoStatus,
} from '../dominio/torneio';
import {
  buscarTorneio,
  enviarPlanilha,
  type ErroPlanilha,
  type PlanilhaImportada,
  type StatusConferencia,
  type TorneioComPartidas,
} from '../servicos/api';

const props = defineProps<{ id: number }>();

const torneio = ref<TorneioComPartidas | null>(null);
const erroAoCarregar = ref<string | null>(null);

async function carregar() {
  try {
    torneio.value = await buscarTorneio(props.id);
    erroAoCarregar.value = null;
  } catch (e) {
    erroAoCarregar.value = (e as Error).message;
  }
}
watch(() => props.id, carregar, { immediate: true });

const envio = computed(() => (torneio.value ? envioDaPlanilha(torneio.value) : 'primeira'));
const partidas = computed(() =>
  [...(torneio.value?.partidas ?? [])].sort((a, b) => a.rodada - b.rodada || a.id - b.id),
);

// --- envio da planilha ---
const seletor = ref<HTMLInputElement | null>(null);
const arquivoEscolhido = ref<File | null>(null);
const confirmandoSubstituicao = ref(false);
const enviando = ref(false);
const importada = ref<PlanilhaImportada | null>(null);
const recusa = ref<{ arquivo: string; erros: ErroPlanilha[]; convertidoDeWindows1252: boolean } | null>(null);
const erroDoEnvio = ref<string | null>(null);

function escolherArquivo() {
  seletor.value?.click();
}

function aoEscolher(evento: Event) {
  const entrada = evento.target as HTMLInputElement;
  const arquivo = entrada.files?.[0] ?? null;
  entrada.value = ''; // permite escolher o mesmo arquivo de novo depois de corrigir no Excel
  if (!arquivo) return;
  arquivoEscolhido.value = arquivo;
  // D22: a planilha nova substitui a anterior e a conferência feita; pede confirmação antes
  if (envio.value === 'substituir') confirmandoSubstituicao.value = true;
  else void enviar();
}

function cancelarSubstituicao() {
  confirmandoSubstituicao.value = false;
  arquivoEscolhido.value = null;
}

async function enviar() {
  confirmandoSubstituicao.value = false;
  const arquivo = arquivoEscolhido.value;
  if (!arquivo) return;
  enviando.value = true;
  importada.value = null;
  recusa.value = null;
  erroDoEnvio.value = null;
  try {
    const resultado = await enviarPlanilha(props.id, arquivo);
    if (resultado.tipo === 'importada') {
      importada.value = resultado.resultado;
      await carregar();
    } else if (resultado.tipo === 'recusada') {
      recusa.value = { arquivo: arquivo.name, erros: resultado.erros, convertidoDeWindows1252: resultado.convertidoDeWindows1252 };
    } else {
      erroDoEnvio.value = resultado.mensagem;
      await carregar(); // por exemplo, o torneio foi calculado em outra aba
    }
  } catch (e) {
    erroDoEnvio.value = (e as Error).message;
  } finally {
    enviando.value = false;
    arquivoEscolhido.value = null;
  }
}

const tomDaConferencia: Record<StatusConferencia, string> = {
  aguardando: 'neutro',
  em_consulta: 'info',
  conferida: 'sucesso',
  nao_encontrada: 'alerta',
  times_diferentes: 'alerta',
};

const partidasAguardando = computed(() => partidas.value.filter((p) => p.statusConferencia === 'aguardando').length);
</script>

<template>
  <main class="pagina">
    <p v-if="erroAoCarregar" class="aviso erro" role="alert">
      {{ erroAoCarregar }} <RouterLink to="/">Voltar para os torneios</RouterLink>
    </p>
    <p v-else-if="!torneio" class="texto-suave">Carregando o torneio…</p>

    <template v-else>
      <div class="titulo-da-pagina">
        <div class="trilha"><RouterLink to="/">Torneios</RouterLink> / {{ torneio.nome }}</div>
        <h1>{{ torneio.nome }}</h1>
        <div class="pilulas">
          <span class="pilula">Prêmio <strong class="mono valor">{{ formatarCentavos(torneio.premioCentavos) }}</strong></span>
          <span class="pilula">{{ resumoDosPercentuais(torneio.percentuais) }}</span>
          <span class="pilula">{{ rotuloDoModo(torneio.modoDivisao) }}</span>
          <span class="pilula">{{ rotuloDoStatus(torneio.status) }}</span>
        </div>
      </div>

      <section class="cartao" aria-labelledby="t-planilha">
        <div class="titulo-com-acao">
          <div class="titulo-da-pagina">
            <h2 id="t-planilha">Planilha</h2>
            <p v-if="torneio.planilhaArquivo" class="texto-medio">
              <span class="mono">{{ torneio.planilhaArquivo }}</span>
              · {{ torneio.partidas.length }} partidas
            </p>
            <p v-else class="texto-medio">Suba a planilha do torneio, exportada do Excel em CSV.</p>
          </div>
          <div v-if="envio !== 'travada'">
            <input ref="seletor" type="file" accept=".csv,text/csv" class="visualmente-oculto" tabindex="-1" aria-hidden="true" @change="aoEscolher" />
            <button
              type="button"
              class="botao"
              :class="{ secundario: envio === 'substituir' }"
              :disabled="enviando"
              @click="escolherArquivo"
            >
              {{ enviando ? 'Enviando…' : envio === 'substituir' ? 'Enviar outra planilha' : 'Escolher a planilha' }}
            </button>
          </div>
        </div>

        <p v-if="envio === 'travada'" class="quadro-suave">
          Os prêmios já foram calculados: a planilha e a forma de divisão ficaram travadas.
        </p>

        <div v-if="importada" class="aviso sucesso" role="status">
          <strong>Planilha importada: {{ importada.linhas }} linhas e {{ importada.partidas }} partidas.</strong>
          <span v-if="importada.substituiuPlanilhaAnterior">A planilha anterior e a conferência feita com ela foram substituídas.</span>
          <span>As partidas aguardam a conferência no site oficial.</span>
        </div>

        <p v-if="torneio.planilhaConvertidaDeWindows1252" class="aviso alerta" role="note">
          A planilha não estava em UTF-8 e foi convertida de Windows-1252. Confira se os acentos dos nomes de times e nicks estão certos na lista de partidas.
        </p>

        <p v-if="erroDoEnvio" class="aviso erro" role="alert">{{ erroDoEnvio }}</p>

        <div v-if="recusa" class="recusa" role="alert">
          <div class="aviso erro">
            <strong>A planilha <span class="mono">{{ recusa.arquivo }}</span> não foi importada.</strong>
            <span>
              Corrija {{ recusa.erros.length === 1 ? 'o problema abaixo' : `os ${recusa.erros.length} problemas abaixo` }} no Excel e envie de novo.
              <template v-if="torneio.planilhaArquivo">A planilha que já estava no torneio continua valendo.</template>
            </span>
          </div>
          <div class="rolagem">
            <table class="tabela erros">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Coluna</th>
                  <th>Problema</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(e, i) in recusa.erros" :key="i">
                  <td class="mono">{{ linhasDoErro(e) }}</td>
                  <td>{{ e.coluna ?? '—' }}</td>
                  <td>{{ e.mensagem }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="recusa.convertidoDeWindows1252" class="texto-suave">
            O arquivo não estava em UTF-8 e foi lido como Windows-1252.
          </p>
        </div>
      </section>

      <section v-if="partidas.length" class="cartao" aria-labelledby="t-partidas">
        <div class="titulo-com-acao">
          <h2 id="t-partidas">Partidas</h2>
          <span class="texto-suave">{{ partidasAguardando }} de {{ partidas.length }} aguardando o site oficial</span>
        </div>
        <div class="rolagem">
          <table class="tabela partidas">
            <thead>
              <tr>
                <th>Partida</th>
                <th class="numero">Rodada</th>
                <th>Data</th>
                <th>Times</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in partidas" :key="p.id">
                <td class="mono">{{ p.idPartida }}</td>
                <td class="numero">{{ p.rodada }}</td>
                <td class="mono">{{ formatarData(p.data) }}</td>
                <td>{{ p.timeA }} x {{ p.timeB }}</td>
                <td><span class="selo" :class="tomDaConferencia[p.statusConferencia]">{{ rotuloDaConferencia(p.statusConferencia) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <DialogoConfirmacao
        :aberto="confirmandoSubstituicao"
        titulo="Substituir a planilha?"
        texto-confirmar="Substituir a planilha"
        perigo
        @confirmar="enviar"
        @cancelar="cancelarSubstituicao"
      >
        <p>
          A planilha atual (<span class="mono">{{ torneio.planilhaArquivo }}</span>, com {{ torneio.partidas.length }} partidas)
          será trocada por <span class="mono">{{ arquivoEscolhido?.name }}</span>.
        </p>
        <p>A conferência já feita no site oficial será apagada e recomeça do zero com a planilha nova.</p>
      </DialogoConfirmacao>
    </template>
  </main>
</template>

<style scoped>
.valor {
  font-weight: 500;
}
.recusa {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tabela.erros td:first-child {
  white-space: nowrap;
}
.tabela.partidas {
  min-width: 640px;
}
</style>
