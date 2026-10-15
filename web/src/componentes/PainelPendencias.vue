<script setup lang="ts">
/**
 * A aba "Pendências" (etapa 5d, D17, protótipo 1-revisao): bloqueantes primeiro, com o aviso de
 * corrigir o ID; depois as não bloqueantes, com planilha e site lado a lado (D4) e o "Ciente".
 * Quem carrega a lista é a página (ela também conta as abas); aqui só se age sobre ela e se pede
 * para recarregar.
 */
import { computed, nextTick, ref } from 'vue';
import DialogoConfirmacao from './DialogoConfirmacao.vue';
import { formatarHora } from '../dominio/conferencia';
import {
  descricaoCurta,
  rotuloDoTipo,
  rotuloDoValor,
  textoDasMarcadas,
  textosDoCienteDeTodas,
  tituloDaPendencia,
  valorDoLado,
} from '../dominio/pendencias';
import { cienteDeTodas, corrigirIdPartida, definirCiente, type ListaDePendencias, type Partida, type Pendencia } from '../servicos/api';

const props = defineProps<{
  torneioId: number;
  lista: ListaDePendencias;
  partidas: Partida[];
  /** Depois do cálculo: a lista fica só para leitura. */
  somenteLeitura: boolean;
  /** Recarrega o torneio e as pendências; a página passa a sua função de carregar. */
  recarregar: () => Promise<void>;
}>();

const aviso = ref<{ tom: 'sucesso' | 'alerta' | 'erro'; texto: string } | null>(null);
/** Chave da pendência com pedido em andamento: o botão fica desabilitado até a resposta. */
const enviando = ref<string | null>(null);
const confirmandoTodas = ref(false);

const semCiente = computed(() => props.lista.naoBloqueantes.filter((p) => !p.ciente));
const textosDoModal = computed(() => textosDoCienteDeTodas(semCiente.value.length, props.lista.bloqueantes.length));
const vazio = computed(() => props.lista.bloqueantes.length === 0 && props.lista.naoBloqueantes.length === 0);

async function alternarCiente(p: Pendencia) {
  enviando.value = p.chave;
  aviso.value = null;
  try {
    const resultado = await definirCiente(props.torneioId, p.chave, !p.ciente);
    if (resultado.tipo === 'mudou') {
      await props.recarregar();
      aviso.value = {
        tom: 'alerta',
        texto: 'Os dados desta pendência mudaram enquanto você olhava (o site pode ter respondido de novo). A lista foi atualizada: confira de novo antes de dar Ciente.',
      };
      return;
    }
    if (resultado.tipo === 'erro') aviso.value = { tom: 'erro', texto: resultado.mensagem };
    await props.recarregar();
  } catch (e) {
    aviso.value = { tom: 'erro', texto: (e as Error).message };
  } finally {
    enviando.value = null;
  }
}

async function confirmarTodas() {
  confirmandoTodas.value = false;
  aviso.value = null;
  try {
    const resultado = await cienteDeTodas(props.torneioId);
    await props.recarregar();
    aviso.value = resultado.tipo === 'ok'
      ? { tom: 'sucesso', texto: textoDasMarcadas(resultado.marcadas) }
      : { tom: 'erro', texto: resultado.mensagem };
  } catch (e) {
    aviso.value = { tom: 'erro', texto: (e as Error).message };
  }
}

const papelDoAviso = (tom: string) => (tom === 'sucesso' ? 'status' : 'alert');

// --- correção do ID (5e, D5, D16): só nas bloqueantes; só o ID é editável
const corrigindo = ref<string | null>(null);
const idNovo = ref('');
const erroDaCorrecao = ref<string | null>(null);
const salvandoCorrecao = ref(false);

/** A partida da pendência, pelo ID atual (o que a API usa na rota é o id interno). */
const partidaDa = (p: Pendencia) => props.partidas.find((x) => x.idPartida === p.idPartida) ?? null;

function abrirCorrecao(p: Pendencia) {
  corrigindo.value = p.chave;
  idNovo.value = p.idPartida ?? '';
  erroDaCorrecao.value = null;
  void nextTick(() => document.getElementById(`id-novo-${p.chave}`)?.focus());
}

function cancelarCorrecao() {
  corrigindo.value = null;
  erroDaCorrecao.value = null;
}

async function salvarCorrecao(p: Pendencia) {
  const partida = partidaDa(p);
  if (!partida) return;
  salvandoCorrecao.value = true;
  erroDaCorrecao.value = null;
  aviso.value = null;
  try {
    const resultado = await corrigirIdPartida(props.torneioId, partida.id, idNovo.value);
    if (resultado.tipo === 'erro') {
      erroDaCorrecao.value = resultado.mensagem;
      return;
    }
    corrigindo.value = null;
    // recarregar religa a atualização a cada 5 s: a partida corrigida está aguardando o site
    await props.recarregar();
    aviso.value = {
      tom: 'sucesso',
      texto: `ID corrigido: a partida ${resultado.partida.idPartida} voltou para "Aguardando o site" e será consultada no site oficial.`,
    };
  } catch (e) {
    erroDaCorrecao.value = (e as Error).message;
  } finally {
    salvandoCorrecao.value = false;
  }
}
</script>

<template>
  <div class="painel">
    <p v-if="somenteLeitura" class="quadro-suave">
      O torneio já foi calculado: as pendências ficam só para consulta.
    </p>

    <p v-if="aviso" class="aviso" :class="aviso.tom" :role="papelDoAviso(aviso.tom)">{{ aviso.texto }}</p>

    <p v-if="vazio" class="texto-medio vazio">Nenhuma pendência: tudo o que foi conferido bateu com o site oficial.</p>

    <div v-else class="introducao">
      <p class="texto-medio">
        <template v-if="lista.naoBloqueantes.length">
          Encontramos {{ lista.naoBloqueantes.length }} {{ lista.naoBloqueantes.length === 1 ? 'diferença' : 'diferenças' }}
          entre a sua planilha e o site oficial. O cálculo usa sempre os dados do site. Confirme que viu cada uma.
        </template>
        <template v-if="lista.bloqueantes.length">
          {{ lista.bloqueantes.length === 1 ? 'Uma partida precisa' : `${lista.bloqueantes.length} partidas precisam` }} de correção do ID.
        </template>
      </p>
      <button v-if="!somenteLeitura && semCiente.length" type="button" class="botao secundario" @click="confirmandoTodas = true">
        Ciente de todas
      </button>
    </div>

    <article v-for="p in lista.bloqueantes" :key="p.chave" class="cartao pendencia bloqueante" :aria-label="descricaoCurta(p)">
      <div class="cabecalho-pendencia">
        <span class="selo erro">{{ rotuloDoTipo(p.tipo) }}</span>
        <strong>{{ tituloDaPendencia(p, partidas) }}</strong>
      </div>
      <p class="texto-medio">{{ p.mensagem }}</p>
      <div class="lado-a-lado">
        <div class="lado planilha">
          <span class="titulo-lado">Na planilha</span>
          <div class="linha-valor"><span>{{ rotuloDoValor(p) }}</span><span class="mono">{{ valorDoLado(p, 'planilha') }}</span></div>
        </div>
        <div class="lado site">
          <span class="titulo-lado">No site oficial</span>
          <div class="linha-valor"><span>{{ rotuloDoValor(p) }}</span><span class="mono">{{ valorDoLado(p, 'site') }}</span></div>
        </div>
      </div>
      <p class="aviso erro">
        <strong>Corrija o ID desta partida.</strong>
        <span>Enquanto o ID não for corrigido, a partida não é conferida e o cálculo não libera.</span>
      </p>

      <template v-if="!somenteLeitura && partidaDa(p)">
        <form v-if="corrigindo === p.chave" class="correcao" novalidate @submit.prevent="salvarCorrecao(p)">
          <div class="grupo">
            <label class="rotulo" :for="`id-novo-${p.chave}`">ID correto da partida</label>
            <input
              :id="`id-novo-${p.chave}`"
              v-model="idNovo"
              class="campo mono"
              inputmode="numeric"
              autocomplete="off"
              :aria-invalid="Boolean(erroDaCorrecao)"
              :aria-describedby="`ajuda-id-${p.chave}${erroDaCorrecao ? ` erro-id-${p.chave}` : ''}`"
            />
            <span :id="`ajuda-id-${p.chave}`" class="ajuda">Como no jogo, por exemplo #45659. Só o ID muda; o site é consultado de novo.</span>
            <span v-if="erroDaCorrecao" :id="`erro-id-${p.chave}`" class="mensagem-erro" role="alert">{{ erroDaCorrecao }}</span>
          </div>
          <div class="acoes-correcao">
            <button type="button" class="botao neutro" @click="cancelarCorrecao">Cancelar</button>
            <button type="submit" class="botao" :disabled="salvandoCorrecao">{{ salvandoCorrecao ? 'Salvando…' : 'Salvar e consultar de novo' }}</button>
          </div>
        </form>
        <div v-else class="acoes">
          <button type="button" class="botao" :aria-label="`Corrigir ID: ${descricaoCurta(p)}`" @click="abrirCorrecao(p)">Corrigir ID</button>
        </div>
      </template>
    </article>

    <article
      v-for="p in lista.naoBloqueantes"
      :key="p.chave"
      class="cartao pendencia"
      :class="{ 'com-ciente': p.ciente }"
      :aria-label="descricaoCurta(p)"
    >
      <div class="cabecalho-pendencia">
        <span class="selo alerta">{{ rotuloDoTipo(p.tipo) }}</span>
        <strong>{{ tituloDaPendencia(p, partidas) }}</strong>
        <span v-if="p.ciente && p.cienteEm" class="selo sucesso marcado">Ciente às {{ formatarHora(p.cienteEm) }}</span>
      </div>
      <p class="texto-medio">{{ p.mensagem }}</p>
      <div class="lado-a-lado">
        <div class="lado planilha">
          <span class="titulo-lado">Na planilha</span>
          <div class="linha-valor"><span>{{ rotuloDoValor(p) }}</span><span class="mono">{{ valorDoLado(p, 'planilha') }}</span></div>
        </div>
        <div class="lado site">
          <span class="titulo-lado">No site oficial · usado no cálculo</span>
          <div class="linha-valor"><span>{{ rotuloDoValor(p) }}</span><span class="mono">{{ valorDoLado(p, 'site') }}</span></div>
        </div>
      </div>
      <div v-if="!somenteLeitura" class="acoes">
        <button
          v-if="!p.ciente"
          type="button"
          class="botao"
          :disabled="enviando === p.chave"
          :aria-label="`Ciente: ${descricaoCurta(p)}`"
          @click="alternarCiente(p)"
        >
          Ciente
        </button>
        <button
          v-else
          type="button"
          class="botao neutro"
          :disabled="enviando === p.chave"
          :aria-label="`Desfazer o Ciente: ${descricaoCurta(p)}`"
          @click="alternarCiente(p)"
        >
          Desfazer
        </button>
      </div>
    </article>

    <DialogoConfirmacao
      v-if="!somenteLeitura"
      :aberto="confirmandoTodas"
      :titulo="textosDoModal.titulo"
      :texto-confirmar="textosDoModal.confirmar"
      @confirmar="confirmarTodas"
      @cancelar="confirmandoTodas = false"
    >
      <p>Você confirma que viu cada diferença. O cálculo usa os dados do site oficial.</p>
      <p v-if="textosDoModal.bloqueantes">{{ textosDoModal.bloqueantes }}</p>
    </DialogoConfirmacao>
  </div>
</template>

<style scoped>
.painel {
  display: flex;
  flex-direction: column;
  gap: var(--espaco-4);
  padding-top: var(--espaco-4);
}
.vazio {
  padding-top: var(--espaco-1);
}
.introducao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--espaco-3);
}
.introducao p {
  flex: 1 1 320px;
}
.pendencia {
  gap: 14px;
}
.pendencia.com-ciente {
  border-color: var(--sucesso-fundo);
}
.cabecalho-pendencia {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espaco-2) 10px;
}
.marcado {
  margin-left: auto;
}
.lado-a-lado {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: var(--espaco-3);
}
.lado {
  border-radius: var(--raio);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.lado.planilha {
  background: var(--superficie-suave);
}
.lado.site {
  background: var(--primaria-clara);
}
.titulo-lado {
  font-size: var(--texto-xs);
  font-weight: var(--peso-forte);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--texto-suave);
}
.lado.site .titulo-lado {
  color: var(--primaria-escura);
}
/* o rótulo (nick, campo) nunca quebra no meio; um valor longo desce para a linha de baixo */
.linha-valor {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--espaco-1) var(--espaco-3);
}
.linha-valor > span:first-child {
  flex: 0 0 auto;
  overflow-wrap: normal;
}
.linha-valor .mono {
  flex: 1 1 12ch;
  min-width: 0;
  text-align: right;
}
.acoes {
  display: flex;
  justify-content: flex-end;
}
.correcao {
  display: flex;
  flex-direction: column;
  gap: var(--espaco-3);
  border-top: 1px solid var(--linha-tabela);
  padding-top: var(--espaco-4);
}
.correcao .campo {
  width: 220px;
}
.acoes-correcao {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--espaco-3);
}
@media (max-width: 640px) {
  .acoes .botao,
  .introducao .botao,
  .acoes-correcao .botao {
    width: 100%;
  }
  .correcao .campo {
    width: 100%;
  }
  .marcado {
    margin-left: 0;
  }
}
</style>
