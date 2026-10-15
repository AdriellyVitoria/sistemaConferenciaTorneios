<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import AvisoDoCalculo from '../componentes/AvisoDoCalculo.vue';
import DialogoConfirmacao from '../componentes/DialogoConfirmacao.vue';
import PainelPendencias from '../componentes/PainelPendencias.vue';
import { partidasConferidas, pendenciasQueFaltam } from '../dominio/pendencias';
import {
  estadoDoTentarAgora,
  precisaAcompanhar,
  progressoDaConferencia,
  segundosAte,
  situacaoNaFila,
} from '../dominio/conferencia';
import { formatarCentavos } from '../dominio/dinheiro';
import { resumoDosPercentuais } from '../dominio/percentuais';
import {
  envioDaPlanilha,
  formatarData,
  linhasDoErro,
  rotuloDoId,
  rotuloDoModo,
  rotuloDoStatus,
} from '../dominio/torneio';
import { criarSondagem } from '../utilitarios/sondagem';
import {
  buscarTorneio,
  enviarPlanilha,
  listarPendencias,
  tentarAgora,
  type ErroPlanilha,
  type ListaDePendencias,
  type PlanilhaImportada,
  type TorneioComPartidas,
} from '../servicos/api';

const props = defineProps<{ id: number }>();

const torneio = ref<TorneioComPartidas | null>(null);
const pendencias = ref<ListaDePendencias | null>(null);
const erroAoCarregar = ref<string | null>(null);
/** Falha ao atualizar uma tela que já tem dados: avisa, sem apagar o que está na tela. */
const semConexao = ref(false);
/** O relógio da tela, para a contagem do botão e o "próxima em instantes". */
const agora = ref(Date.now());

// --- atualização periódica (etapa 4c): a cada 5 s enquanto houver partida esperando o site
const sondagem = criarSondagem({
  intervaloMs: 5_000,
  atualizar: async () => {
    await carregar();
    return torneio.value !== null && precisaAcompanhar(torneio.value.partidas);
  },
});

async function carregar() {
  try {
    // o torneio e as pendências juntos: a conferência que avança também faz pendências aparecerem
    const [recebido, recebidas] = await Promise.all([buscarTorneio(props.id), listarPendencias(props.id)]);
    torneio.value = recebido;
    pendencias.value = recebidas;
    erroAoCarregar.value = null;
    semConexao.value = false;
    agora.value = Date.now();
    iniciarContagem(recebido.segundosParaTentarAgora);
    if (precisaAcompanhar(recebido.partidas)) sondagem.garantirAtiva();
  } catch (e) {
    if (torneio.value) semConexao.value = true;
    else erroAoCarregar.value = (e as Error).message;
  }
}
watch(
  () => props.id,
  () => {
    sondagem.parar();
    torneio.value = null;
    void carregar();
  },
  { immediate: true },
);

const envio = computed(() => (torneio.value ? envioDaPlanilha(torneio.value) : 'primeira'));
const partidas = computed(() =>
  [...(torneio.value?.partidas ?? [])].sort((a, b) => a.rodada - b.rodada || a.id - b.id),
);

// --- progresso e abas
const progresso = computed(() => progressoDaConferencia(partidas.value));
const naFila = computed(() =>
  partidas.value
    .filter((p) => p.statusConferencia === 'aguardando' || p.statusConferencia === 'em_consulta')
    .map((p) => ({ partida: p, situacao: situacaoNaFila(p, new Date(agora.value)) })),
);
// as três abas da D17: cada partida está em uma só
const conferidas = computed(() => (pendencias.value ? partidasConferidas(partidas.value, pendencias.value) : []));
const faltam = computed(() => (pendencias.value ? pendenciasQueFaltam(pendencias.value) : 0));
const somenteLeitura = computed(() => torneio.value?.status === 'calculado');

type Aba = 'conferidas' | 'pendencias' | 'aguardando';
const abaEscolhida = ref<Aba | null>(null);
// sem escolha da Maria: abre onde há algo a fazer (pendências), depois no que depende do site
/** Cada item do aviso "pronto para calcular" leva à aba onde se resolve, e o foco vai junto. */
async function irParaAba(destino: Aba) {
  abaEscolhida.value = destino;
  await nextTick();
  document.getElementById(`aba-${destino}`)?.focus();
}

function abaInicial(): Aba {
  if (faltam.value > 0) return 'pendencias';
  return naFila.value.length ? 'aguardando' : 'conferidas';
}
const aba = computed<Aba>(() => abaEscolhida.value ?? abaInicial());
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'conferidas', rotulo: 'Conferidas' },
  { id: 'pendencias', rotulo: 'Pendências' },
  { id: 'aguardando', rotulo: 'Aguardando o site' },
];
const contagemDaAba = computed<Record<Aba, number>>(() => ({
  conferidas: conferidas.value.length,
  pendencias: faltam.value,
  aguardando: naFila.value.length,
}));

// --- "tentar agora": a contagem do bloqueio de 30 s vem da API e corre aqui a cada segundo
let liberaEm = 0;
let relogio: ReturnType<typeof setInterval> | undefined;
const segundosRestantes = computed(() => segundosAte(liberaEm, agora.value));

function iniciarContagem(segundos: number) {
  liberaEm = Date.now() + segundos * 1000;
  agora.value = Date.now();
  if (segundos > 0 && relogio === undefined) {
    relogio = setInterval(() => {
      agora.value = Date.now();
      if (segundosRestantes.value === 0) pararContagem();
    }, 1_000);
  }
}
function pararContagem() {
  if (relogio !== undefined) clearInterval(relogio);
  relogio = undefined;
}

const botaoTentarAgora = computed(() =>
  torneio.value
    ? estadoDoTentarAgora({ partidas: partidas.value, segundosParaTentarAgora: segundosRestantes.value, status: torneio.value.status })
    : { habilitado: false, rotulo: 'Tentar agora', motivo: null },
);
const tentando = ref(false);
const avisoTentarAgora = ref<{ tom: 'sucesso' | 'alerta' | 'erro'; texto: string } | null>(null);

function textoDasAntecipadas(quantas: number): string {
  if (quantas === 0) return 'As partidas já estavam na vez: serão consultadas em instantes.';
  const partidasAntecipadas = quantas === 1 ? '1 partida antecipada' : `${quantas} partidas antecipadas`;
  return `${partidasAntecipadas}: serão consultadas em instantes.`;
}

async function clicarTentarAgora() {
  tentando.value = true;
  avisoTentarAgora.value = null;
  try {
    const resultado = await tentarAgora(props.id);
    if (resultado.tipo === 'antecipadas') {
      iniciarContagem(resultado.segundosParaTentarAgora);
      avisoTentarAgora.value = { tom: 'sucesso', texto: textoDasAntecipadas(resultado.antecipadas) };
    } else if (resultado.tipo === 'aguarde') {
      iniciarContagem(resultado.segundosParaTentarAgora);
      avisoTentarAgora.value = { tom: 'alerta', texto: resultado.mensagem };
    } else {
      avisoTentarAgora.value = { tom: 'erro', texto: resultado.mensagem };
    }
    await carregar();
  } catch (e) {
    avisoTentarAgora.value = { tom: 'erro', texto: (e as Error).message };
  } finally {
    tentando.value = false;
  }
}

// ao sair da página, nada fica rodando
onUnmounted(() => {
  sondagem.parar();
  pararContagem();
});

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

      <AvisoDoCalculo :calculo="torneio.calculo" @ir-para="irParaAba" />

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
            <table class="tabela erros empilhavel">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Coluna</th>
                  <th>Problema</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(e, i) in recusa.erros" :key="i">
                  <td class="numeral" data-rotulo="Linha">{{ linhasDoErro(e) }}</td>
                  <td data-rotulo="Coluna">{{ e.coluna ?? '—' }}</td>
                  <td data-rotulo="Problema">{{ e.mensagem }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="recusa.convertidoDeWindows1252" class="texto-suave">
            O arquivo não estava em UTF-8 e foi lido como Windows-1252.
          </p>
        </div>
      </section>

      <section v-if="partidas.length" class="cartao" aria-labelledby="t-conferencia">
        <div class="titulo-com-acao">
          <div class="titulo-da-pagina">
            <h2 id="t-conferencia">Conferência com o site oficial</h2>
            <p class="texto-medio" aria-live="polite">
              <strong class="numeral">{{ progresso.conferidas }}</strong> de <span class="numeral">{{ progresso.total }}</span> conferidas
              <template v-if="progresso.aguardandoOSite"> · {{ progresso.aguardandoOSite }} aguardando o site</template>
            </p>
          </div>
          <div class="tentar-agora">
            <button type="button" class="botao secundario" :disabled="!botaoTentarAgora.habilitado || tentando" @click="clicarTentarAgora">
              {{ tentando ? 'Antecipando…' : botaoTentarAgora.rotulo }}
            </button>
            <span v-if="botaoTentarAgora.motivo && progresso.aguardandoOSite" class="ajuda">{{ botaoTentarAgora.motivo }}</span>
          </div>
        </div>
        <div
          class="barra"
          role="progressbar"
          :aria-valuenow="progresso.conferidas"
          aria-valuemin="0"
          :aria-valuemax="progresso.total"
          :aria-label="`${progresso.conferidas} de ${progresso.total} partidas conferidas`"
        >
          <div class="barra-cheia" :style="{ width: `${progresso.percentual}%` }" />
        </div>
        <p v-if="avisoTentarAgora" class="aviso" :class="avisoTentarAgora.tom" role="status">{{ avisoTentarAgora.texto }}</p>
        <p v-if="semConexao" class="aviso alerta" role="status">Sem conexão com o servidor. A tela tenta atualizar de novo em instantes.</p>
      </section>

      <section v-if="partidas.length" class="cartao" aria-label="Partidas">
        <div role="tablist" aria-label="Situação das partidas" class="abas">
          <button
            v-for="a in ABAS"
            :id="`aba-${a.id}`"
            :key="a.id"
            type="button"
            role="tab"
            :aria-selected="aba === a.id"
            :aria-controls="`painel-${a.id}`"
            class="aba"
            @click="abaEscolhida = a.id"
          >
            {{ a.rotulo }} <span class="contador" :class="{ destaque: a.id === 'pendencias' && contagemDaAba[a.id] > 0 }">{{ contagemDaAba[a.id] }}</span>
          </button>
        </div>

        <div v-if="aba === 'pendencias'" id="painel-pendencias" role="tabpanel" aria-labelledby="aba-pendencias">
          <PainelPendencias
            v-if="pendencias"
            :torneio-id="torneio.id"
            :lista="pendencias"
            :partidas="partidas"
            :somente-leitura="somenteLeitura"
            :recarregar="carregar"
          />
        </div>

        <div v-else-if="aba === 'aguardando'" id="painel-aguardando" role="tabpanel" aria-labelledby="aba-aguardando">
          <p v-if="naFila.length === 0" class="texto-medio vazio-aba">Nenhuma partida esperando o site oficial.</p>
          <ul v-else class="fila">
            <li v-for="{ partida: p, situacao } in naFila" :key="p.id" class="item-fila">
              <div class="item-cabecalho">
                <span class="selo" :class="situacao.selo.tom">{{ situacao.selo.texto }}</span>
                <strong>Partida <span class="mono">{{ rotuloDoId(p) }}</span> · Rodada {{ p.rodada }} · {{ p.timeA }} x {{ p.timeB }}</strong>
              </div>
              <p v-if="situacao.motivo" class="texto-medio">{{ situacao.motivo }}</p>
              <p class="texto-suave">{{ situacao.horario }}</p>
            </li>
          </ul>
        </div>

        <div v-else id="painel-conferidas" role="tabpanel" aria-labelledby="aba-conferidas" class="rolagem">
          <p v-if="conferidas.length === 0" class="texto-medio vazio-aba">Nenhuma partida conferida ainda.</p>
          <table v-else class="tabela partidas empilhavel">
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
              <tr v-for="{ partida: p, comCiente } in conferidas" :key="p.id">
                <td class="mono" data-rotulo="Partida">{{ rotuloDoId(p) }}</td>
                <td class="numero" data-rotulo="Rodada">{{ p.rodada }}</td>
                <td class="numeral" data-rotulo="Data">{{ formatarData(p.data) }}</td>
                <td data-rotulo="Times">{{ p.timeA }} x {{ p.timeB }}</td>
                <td data-rotulo="Situação">
                  <span v-if="comCiente" class="selo info">Conferida com Ciente</span>
                  <span v-else class="selo sucesso">Bateu com o site</span>
                </td>
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
  font-weight: var(--peso-medio);
}
.recusa {
  display: flex;
  flex-direction: column;
  gap: var(--espaco-3);
}
.tabela.erros td:first-child {
  white-space: nowrap;
}
.tentar-agora {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--espaco-1);
}
.barra {
  height: var(--espaco-2);
  background: var(--primaria-clara);
  border-radius: var(--raio-pilula);
  overflow: hidden;
}
.barra-cheia {
  height: 100%;
  background: var(--primaria);
  transition: width 0.4s ease;
}
@media (prefers-reduced-motion: reduce) {
  .barra-cheia {
    transition: none;
  }
}
.vazio-aba {
  padding: var(--espaco-4) 0 var(--espaco-1);
}
.fila {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item-fila {
  padding: 14px 0;
  border-bottom: 1px solid var(--linha-tabela);
  display: flex;
  flex-direction: column;
  gap: var(--espaco-1);
}
.item-fila:last-child {
  border-bottom: none;
}
.item-cabecalho {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
@media (max-width: 640px) {
  .tentar-agora {
    align-items: stretch;
    width: 100%;
  }
  .aba {
    flex: 1 1 auto;
    padding-inline: var(--espaco-2);
  }
}
</style>
