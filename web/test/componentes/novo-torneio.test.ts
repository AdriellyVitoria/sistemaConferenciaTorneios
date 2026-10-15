// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { rotas } from '../../src/roteador';
import PaginaNovoTorneio from '../../src/paginas/PaginaNovoTorneio.vue';

function montar() {
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  return mount(PaginaNovoTorneio, { global: { plugins: [roteador] } });
}

const botoesRemover = (pagina: ReturnType<typeof montar>) =>
  pagina.findAll('button').filter((b) => b.text() === 'Remover');

describe('novo torneio: botão "Remover" posição', () => {
  it('com as três posições iniciais, cada uma tem o seu "Remover"', () => {
    expect(botoesRemover(montar())).toHaveLength(3);
  });

  it('com uma posição só, o "Remover" não aparece', async () => {
    const pagina = montar();
    await botoesRemover(pagina)[2].trigger('click');
    await botoesRemover(pagina)[1].trigger('click');

    expect(pagina.findAll('.posicao')).toHaveLength(1);
    expect(botoesRemover(pagina)).toHaveLength(0);
  });

  it('ao adicionar outra posição, o "Remover" volta nas duas', async () => {
    const pagina = montar();
    await botoesRemover(pagina)[2].trigger('click');
    await botoesRemover(pagina)[1].trigger('click');
    await pagina.findAll('button').find((b) => b.text() === 'Adicionar posição')!.trigger('click');

    expect(botoesRemover(pagina)).toHaveLength(2);
  });
});
