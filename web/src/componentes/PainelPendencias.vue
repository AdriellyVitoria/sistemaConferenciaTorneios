<script setup lang="ts">
/**
 * A aba "Pendências" (etapa 5d, D17, protótipo 1-revisao): só o que falta. Bloqueantes primeiro,
 * com o aviso de corrigir o ID; depois as não bloqueantes sem Ciente, com planilha e site lado a
 * lado (D4) e o "Ciente". Com o Ciente, a pendência sai daqui e a partida vai para Conferidas
 * (5f: cada problema num lugar só); o aviso tem um "Desfazer" para o arrependimento imediato.
 * Quem carrega a lista é a página (ela também conta as abas); aqui só se age sobre ela e se pede
 * para recarregar.
 */
import { computed, nextTick, ref } from 'vue';
import DialogoConfirmacao from './DialogoConfirmacao.vue';
import LadoALado from './LadoALado.vue';
import {
  descricaoCurta,
  rotuloDoTipo,
  textoDasMarcadas,
  textosDoCienteDeTodas,
  tituloDaPendencia,
} from '../dominio/pendencias';
import { rotuloDoId } from '../dominio/torneio';
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

/** O aviso do topo do painel; depois de um Ciente, traz a pendência para o "Desfazer". */
const aviso = ref<{ tom: 'sucesso' | 'alerta' | 'erro'; texto: string; desfazer?: Pendencia } | null>(null);
/** Chave da pendência com pedido em andamento: o botão fica desabilitado até a resposta. */
const enviando = ref<string | null>(null);
const confirmandoTodas = ref(false);

const semCiente = computed(() => props.lista.naoBloqueantes.filter((p) => !p.ciente));
const comCiente = computed(() => props.lista.naoBloqueantes.length - semCiente.value.length);
const textosDoModal = computed(() => textosDoCienteDeTodas(semCiente.value.length, props.lista.bloqueantes.length));
/** Nada a fazer aqui: nem bloqueante nem não bloqueante sem Ciente. */
const nadaFaltando = computed(() => props.lista.bloqueantes.length === 0 && semCiente.value.length === 0);

const MUDOU = 'Os dados desta pendência mudaram enquanto você olhava (o site pode ter respondido de novo). A lista foi atualizada: confira de novo antes de dar Ciente.';

/** Depois do Ciente: a partida foi para Conferidas, ou ainda tem outra pendência aqui. */
function textoDoCiente(p: Pendencia): string {
  if (!p.idPartida) return 'Ciente registrado: as partidas desta pendência foram para Conferidas, se não tinham outra pendência.';
  const aindaFalta = [...props.lista.bloqueantes, ...semCiente.value].some((x) => x.idPartida === p.idPartida);
  const partida = props.partidas.find((x) => x.idPartida === p.idPartida);
  const id = partida ? rotuloDoId(partida) : p.idPartida;
  return aindaFalta
    ? `Ciente registrado. A partida ${id} ainda tem pendência aqui.`
    : `Ciente registrado: a partida ${id} foi para Conferidas.`;
}

async function marcarCiente(p: Pendencia) {
  enviando.value = p.chave;
  aviso.value = null;
  try {
    const resultado = await definirCiente(props.torneioId, p.chave, true);
    await props.recarregar();
    if (resultado.tipo === 'ok') aviso.value = { tom: 'sucesso', texto: textoDoCiente(p), desfazer: p };
    else if (resultado.tipo === 'mudou') aviso.value = { tom: 'alerta', texto: MUDOU };
    else aviso.value = { tom: 'erro', texto: resultado.mensagem };
  } catch (e) {
    aviso.value = { tom: 'erro', texto: (e as Error).message };
  } finally {
    enviando.value = null;
  }
}

/** O "Desfazer" do aviso: o arrependimento logo depois do Ciente. */
async function desfazerCiente(p: Pendencia) {
  enviando.value = p.chave;
  try {
    const resultado = await definirCiente(props.torneioId, p.chave, false);
    await props.recarregar();
    if (resultado.tipo === 'ok') aviso.value = { tom: 'sucesso', texto: 'Ciente desfeito: a pendência voltou para a lista.' };
    else if (resultado.tipo === 'mudou') aviso.value = { tom: 'alerta', texto: MUDOU };
    else aviso.value = { tom: 'erro', texto: resultado.mensagem };
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

    <div v-if="aviso" class="aviso aviso-com-acao" :class="aviso.tom" :role="papelDoAviso(aviso.tom)">
      <span>{{ aviso.texto }}</span>
      <button
        v-if="aviso.desfazer && !somenteLeitura"
        type="button"
        class="botao neutro"
        :disabled="enviando === aviso.desfazer.chave"
        :aria-label="`Desfazer o Ciente: ${descricaoCurta(aviso.desfazer)}`"
        @click="desfazerCiente(aviso.desfazer)"
      >
        Desfazer
      </button>
    </div>

    <template v-if="nadaFaltando">
      <p v-if="comCiente === 0" class="texto-medio vazio">Nenhuma pendência: tudo o que foi conferido bateu com o site oficial.</p>
      <p v-else class="texto-medio vazio">
        Nada faltando: {{ comCiente === 1 ? 'a pendência com Ciente está em Conferidas.' : `as ${comCiente} pendências com Ciente estão em Conferidas.` }}
      </p>
    </template>

    <div v-else class="introducao">
      <p class="texto-medio">
        <template v-if="semCiente.length">
          Encontramos {{ semCiente.length }} {{ semCiente.length === 1 ? 'diferença' : 'diferenças' }}
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
      <LadoALado :pendencia="p" titulo-do-site="No site oficial" />
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

    <article v-for="p in semCiente" :key="p.chave" class="cartao pendencia" :aria-label="descricaoCurta(p)">
      <div class="cabecalho-pendencia">
        <span class="selo alerta">{{ rotuloDoTipo(p.tipo) }}</span>
        <strong>{{ tituloDaPendencia(p, partidas) }}</strong>
      </div>
      <p class="texto-medio">{{ p.mensagem }}</p>
      <LadoALado :pendencia="p" />
      <div v-if="!somenteLeitura" class="acoes">
        <button
          type="button"
          class="botao"
          :disabled="enviando === p.chave"
          :aria-label="`Ciente: ${descricaoCurta(p)}`"
          @click="marcarCiente(p)"
        >
          Ciente
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
.cabecalho-pendencia {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espaco-2) 10px;
}
/* o aviso depois do Ciente: o texto e o Desfazer na mesma faixa */
.aviso-com-acao {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--espaco-2) var(--espaco-3);
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
}
</style>
