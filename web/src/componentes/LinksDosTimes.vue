<script setup lang="ts">
/**
 * "Links para os times premiados" (7d, D11), na tela do resultado: o link da página pública e um
 * por time premiado, para a Maria copiar e mandar. O endereço é montado com a origem da própria
 * tela (a API não sabe em que endereço a tela está, 7b).
 *
 * "Copiar link" usa a área de transferência do navegador. Ela pode falhar: o navegador nega, ou nem
 * oferece (endereço sem https, fora do localhost). Aí o link aparece num campo, já selecionado,
 * para copiar à mão.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, useId } from 'vue';
import { formatarCentavos } from '../dominio/dinheiro';
import { enderecoDoLink } from '../dominio/link-do-time';
import { buscarLinks, type LinksDoTorneio } from '../servicos/api';

const props = defineProps<{ torneioId: number }>();

const links = ref<LinksDoTorneio | null>(null);
const erro = ref<string | null>(null);
onMounted(async () => {
  try {
    links.value = await buscarLinks(props.torneioId);
  } catch (e) {
    erro.value = (e as Error).message;
  }
});

interface Item {
  chave: string;
  nome: string;
  rotuloDoBotao: string;
  endereco: string;
}

const origem = window.location.origin;
const itens = computed<Item[]>(() => {
  if (!links.value) return [];
  return [
    {
      chave: 'publico',
      nome: 'Página pública (classificação)',
      rotuloDoBotao: 'Copiar link da página pública',
      endereco: enderecoDoLink(origem, 'publico', links.value.publico.codigo),
    },
    ...links.value.times.map((t) => ({
      chave: `time-${t.codigo}`,
      nome: `${t.time} · ${t.posicao}º · ${formatarCentavos(t.premioCentavos)}`,
      rotuloDoBotao: `Copiar link do time ${t.time}`,
      endereco: enderecoDoLink(origem, 'time', t.codigo),
    })),
  ];
});

const prefixo = useId();
const idDoCampo = (item: Item) => `link-${prefixo}-${item.chave}`;

/** O item com "Link copiado" (some depois de alguns segundos) e os que pedem cópia à mão. */
const copiado = ref<string | null>(null);
const aMao = ref<string[]>([]);
let relogio: ReturnType<typeof setTimeout> | undefined;
onUnmounted(() => clearTimeout(relogio));

async function copiar(item: Item) {
  try {
    if (!navigator.clipboard) throw new Error('sem área de transferência');
    await navigator.clipboard.writeText(item.endereco);
    aMao.value = aMao.value.filter((c) => c !== item.chave);
    copiado.value = item.chave;
    clearTimeout(relogio);
    relogio = setTimeout(() => { copiado.value = null; }, 4_000);
  } catch {
    copiado.value = null;
    if (!aMao.value.includes(item.chave)) aMao.value = [...aMao.value, item.chave];
    await nextTick();
    const campo = document.getElementById(idDoCampo(item)) as HTMLInputElement | null;
    campo?.focus();
    campo?.select();
  }
}
</script>

<template>
  <section class="cartao" aria-labelledby="t-links">
    <h2 id="t-links">Links para os times premiados</h2>
    <p class="texto-medio">Mande a cada time premiado o link dele, com o valor de cada jogador. A página pública, só com a classificação, pode ir para todos.</p>

    <p v-if="erro" class="aviso alerta" role="alert">{{ erro }}</p>
    <p v-else-if="!links" class="texto-suave">Carregando os links…</p>

    <ul v-else class="links">
      <li v-for="item in itens" :key="item.chave">
        <div class="cabeca">
          <span class="nome-do-link">{{ item.nome }}</span>
          <div class="acao">
            <span class="aviso-copia" aria-live="polite">{{ copiado === item.chave ? 'Link copiado' : '' }}</span>
            <button type="button" class="botao secundario" :aria-label="item.rotuloDoBotao" @click="copiar(item)">Copiar link</button>
          </div>
        </div>
        <a :href="item.endereco" class="endereco mono" target="_blank" rel="noopener">{{ item.endereco }}</a>

        <div v-if="aMao.includes(item.chave)" class="grupo a-mao">
          <label :for="idDoCampo(item)" class="ajuda">Link para copiar</label>
          <input :id="idDoCampo(item)" :value="item.endereco" type="text" class="campo mono" readonly @focus="($event.target as HTMLInputElement).select()" />
          <p class="ajuda">Não foi possível copiar sozinho. O link está selecionado: copie com Ctrl+C (no celular, toque e segure).</p>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.links li {
  display: flex;
  flex-direction: column;
  gap: var(--espaco-2);
  padding: var(--espaco-3) 0;
  border-bottom: 1px solid var(--linha-tabela);
  min-width: 0;
}
.links li:last-child {
  border-bottom: none;
}
.cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--espaco-2) var(--espaco-3);
}
.nome-do-link {
  font-weight: var(--peso-forte);
}
.acao {
  display: flex;
  align-items: center;
}
.aviso-copia {
  font-size: var(--texto-sm);
  color: var(--sucesso);
}
/* o aviso fica sempre na página (o leitor de tela anuncia quando o texto aparece), mas só ocupa espaço com texto */
.aviso-copia:not(:empty) {
  margin-right: var(--espaco-3);
}
.endereco {
  font-size: var(--texto-sm);
  overflow-wrap: anywhere;
}
.a-mao {
  gap: var(--espaco-1);
}
.a-mao p {
  margin: 0;
}
/* no celular, o nome numa linha e o botão na de baixo, igual em todos os itens */
@media (max-width: 640px) {
  .cabeca {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
