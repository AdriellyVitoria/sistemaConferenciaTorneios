<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { formatarReais, lerReais } from '../dominio/dinheiro';
import { lerPercentuais } from '../dominio/percentuais';
import { criarTorneio, type ModoDivisao } from '../servicos/api';

const roteador = useRouter();

const nome = ref('');
const premioTexto = ref('');
// cada posição com uma chave própria, para o Vue não confundir os campos ao remover uma do meio
let proximaChave = 0;
const posicoes = ref(['50', '30', '20'].map((texto) => ({ chave: proximaChave++, texto })));
const modo = ref<ModoDivisao>('minutos');

const premio = computed(() => lerReais(premioTexto.value));
const percentuais = computed(() => lerPercentuais(posicoes.value.map((p) => p.texto)));
const erroDoNome = computed(() => (nome.value.trim() === '' ? 'Informe o nome do torneio.' : null));

// os erros do formulário aparecem depois que a Maria sai do campo ou tenta criar, não enquanto digita
const premioTocado = ref(false);
const tentouCriar = ref(false);
const enviando = ref(false);
/** Erros devolvidos pela API, por campo (a validação que vale é a dela). */
const errosDaApi = ref<Record<string, string>>({});

function adicionarPosicao() {
  posicoes.value.push({ chave: proximaChave++, texto: '' });
}
function removerPosicao(indice: number) {
  posicoes.value.splice(indice, 1);
}

/** Ao sair do campo, mostra o prêmio no formato completo: "10000" vira "10.000,00". */
function arrumarPremio() {
  premioTocado.value = true;
  if (premio.value.ok) premioTexto.value = formatarReais(premio.value.centavos);
}

const erro = (campo: 'nome' | 'premioCentavos' | 'percentuais' | 'modoDivisao') => {
  if (errosDaApi.value[campo]) return errosDaApi.value[campo];
  if (campo === 'nome' && tentouCriar.value) return erroDoNome.value;
  if (campo === 'premioCentavos' && (premioTocado.value || tentouCriar.value) && !premio.value.ok) return premio.value.mensagem;
  if (campo === 'percentuais' && tentouCriar.value) return percentuais.value.erro;
  return null;
};

async function criar() {
  tentouCriar.value = true;
  errosDaApi.value = {};
  const valores = percentuais.value.valores;
  if (erroDoNome.value || !premio.value.ok || !valores) return;

  enviando.value = true;
  try {
    const resultado = await criarTorneio({
      nome: nome.value.trim(),
      premioCentavos: premio.value.centavos,
      percentuais: valores,
      modoDivisao: modo.value,
    });
    if (resultado.ok) {
      await roteador.push({ name: 'torneio', params: { id: resultado.id } });
      return;
    }
    errosDaApi.value = Object.fromEntries(resultado.erros.map((e) => [e.campo || 'geral', e.mensagem]));
  } catch (e) {
    errosDaApi.value = { geral: (e as Error).message };
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <main class="pagina estreita">
    <div class="titulo-da-pagina">
      <div class="trilha"><RouterLink to="/">Torneios</RouterLink> / Novo torneio</div>
      <h1>Novo torneio</h1>
      <p class="texto-medio">Defina o prêmio e a regra de divisão antes de subir a planilha. Assim a regra é conhecida antes do resultado.</p>
    </div>

    <form class="cartao formulario" novalidate @submit.prevent="criar">
      <div class="grupo">
        <label class="rotulo" for="nome">Nome do torneio</label>
        <input
          id="nome"
          v-model="nome"
          class="campo"
          maxlength="120"
          placeholder="Ex.: Torneio de setembro/2026"
          :aria-invalid="Boolean(erro('nome'))"
          aria-describedby="erro-nome"
        />
        <span v-if="erro('nome')" id="erro-nome" class="mensagem-erro">{{ erro('nome') }}</span>
      </div>

      <div class="grupo">
        <label class="rotulo" for="premio">Prêmio total</label>
        <div class="campo-reais">
          <span class="prefixo" aria-hidden="true">R$</span>
          <input
            id="premio"
            v-model="premioTexto"
            class="campo mono"
            inputmode="decimal"
            autocomplete="off"
            placeholder="10.000,00"
            :aria-invalid="Boolean(erro('premioCentavos'))"
            aria-describedby="ajuda-premio erro-premio"
            @blur="arrumarPremio"
          />
        </div>
        <span id="ajuda-premio" class="ajuda">Ponto para milhar e vírgula para centavos, como 10.000,00.</span>
        <span v-if="erro('premioCentavos')" id="erro-premio" class="mensagem-erro">{{ erro('premioCentavos') }}</span>
      </div>

      <fieldset class="grupo">
        <legend class="rotulo">Percentual do prêmio por posição</legend>
        <span class="ajuda">Os times nas outras posições não recebem prêmio.</span>
        <ol class="posicoes">
          <li v-for="(posicao, i) in posicoes" :key="posicao.chave" class="posicao">
            <label :for="`pct-${posicao.chave}`" class="lugar">{{ i + 1 }}º lugar</label>
            <div class="campo-percentual">
              <input
                :id="`pct-${posicao.chave}`"
                v-model="posicao.texto"
                class="campo numeral"
                inputmode="numeric"
                autocomplete="off"
                :aria-invalid="Boolean(erro('percentuais'))"
              />
              <span aria-hidden="true">%</span>
            </div>
            <!-- com uma posição só, não há o que remover: o botão nem aparece -->
            <button
              v-if="posicoes.length > 1"
              type="button"
              class="botao-texto"
              :aria-label="`Remover o ${i + 1}º lugar`"
              @click="removerPosicao(i)"
            >
              Remover
            </button>
          </li>
        </ol>
        <div class="soma">
          <button type="button" class="botao secundario" @click="adicionarPosicao">Adicionar posição</button>
          <span aria-live="polite">
            Soma:
            <span class="selo" :class="percentuais.soma === 100 ? 'sucesso' : 'alerta'">{{ percentuais.soma ?? '—' }}%</span>
            <span v-if="percentuais.soma !== null && percentuais.soma !== 100" class="texto-suave">
              (precisa ser 100%)
            </span>
          </span>
        </div>
        <span v-if="erro('percentuais')" class="mensagem-erro">{{ erro('percentuais') }}</span>
      </fieldset>

      <fieldset class="grupo">
        <legend class="rotulo">Divisão do prêmio dentro do time</legend>
        <div class="modos">
          <label class="modo" :class="{ escolhido: modo === 'minutos' }">
            <input v-model="modo" type="radio" name="modo" value="minutos" />
            <span>
              <strong>Por minutos jogados</strong>
              <span class="ajuda">Cada jogador recebe na proporção do tempo em que jogou, somando todas as partidas.</span>
            </span>
          </label>
          <label class="modo" :class="{ escolhido: modo === 'kills' }">
            <input v-model="modo" type="radio" name="modo" value="kills" />
            <span>
              <strong>Por kills</strong>
              <span class="ajuda">Cada jogador recebe na proporção dos abates que fez, somando todas as partidas.</span>
            </span>
          </label>
        </div>
        <p v-if="modo === 'kills'" class="aviso alerta" role="note">
          Jogadores sem nenhuma kill não recebem prêmio. Se ninguém do time fizer kills, o prêmio do time é dividido pelos minutos.
        </p>
        <span class="ajuda">Depois do cálculo dos prêmios, a forma de divisão não pode mais ser mudada.</span>
        <span v-if="erro('modoDivisao')" class="mensagem-erro">{{ erro('modoDivisao') }}</span>
      </fieldset>

      <p v-if="errosDaApi.geral" class="aviso erro" role="alert">{{ errosDaApi.geral }}</p>

      <div class="acoes">
        <RouterLink to="/" class="botao secundario">Cancelar</RouterLink>
        <button type="submit" class="botao" :disabled="enviando">{{ enviando ? 'Criando…' : 'Criar torneio' }}</button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.formulario {
  gap: var(--espaco-6);
}
fieldset {
  border: none;
  margin: 0;
  padding: 0;
  min-width: 0;
}
legend {
  padding: 0;
  margin-bottom: 6px;
}
.campo-reais {
  display: flex;
  align-items: center;
  gap: var(--espaco-2);
}
.campo-reais .campo {
  width: 220px;
}
.prefixo {
  font-family: var(--fonte-mono);
  color: var(--texto-medio);
}
.posicoes {
  list-style: none;
  margin: var(--espaco-1) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espaco-2);
}
.posicao {
  display: flex;
  align-items: center;
  gap: var(--espaco-3);
  min-height: var(--alvo-toque);
}
.lugar {
  width: 72px;
  font-weight: var(--peso-medio);
}
.campo-percentual {
  display: flex;
  align-items: center;
  gap: 6px;
}
.campo-percentual .campo {
  width: 88px;
  text-align: right;
}
.soma {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--espaco-3);
  margin-top: var(--espaco-1);
}
.modos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: var(--espaco-3);
}
.modo {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  padding: 14px;
  cursor: pointer;
}
/* o rádio recebe o foco; o cartão inteiro mostra onde ele está */
.modo:has(input:focus-visible) {
  outline: 3px solid var(--cor-foco);
  outline-offset: 2px;
}
.modo input:focus-visible {
  outline: none;
}
.modo span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.modo input {
  margin-top: 4px;
  accent-color: var(--primaria);
}
.modo.escolhido {
  border-color: var(--primaria);
  background: var(--primaria-clara);
}
.acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--espaco-3);
}
@media (max-width: 640px) {
  .acoes .botao {
    flex: 1 1 100%;
  }
}
</style>
