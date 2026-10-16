import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '../../src/App.vue';
import { rotas } from '../../src/roteador';
import { textoDe } from '../ajudantes/espacos';
import { criarApiFalsa, SENHA_FALSA, type OpcoesApiFalsa } from './api-falsa';

const CHAVE = 'senha-da-organizadora';
const montadas: VueWrapper[] = [];
afterEach(() => {
  for (const p of montadas.splice(0)) p.unmount();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  document.body.innerHTML = '';
});

async function abrir(caminho: string, opcoes: OpcoesApiFalsa = {}) {
  const api = criarApiFalsa(opcoes);
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  await roteador.push(caminho);
  await roteador.isReady();
  const app = mount(App, { global: { plugins: [roteador] }, attachTo: document.body });
  montadas.push(app);
  await flushPromises();
  return { app, api };
}

const telaDeSenha = (app: VueWrapper) => app.find('section[aria-labelledby="t-senha"]');
const campo = (app: VueWrapper) => telaDeSenha(app).find('input[type="password"]');
const botaoSair = (app: VueWrapper) => app.findAll('header button').find((b) => textoDe(b) === 'Sair');
async function entrar(app: VueWrapper, senha: string) {
  await campo(app).setValue(senha);
  await telaDeSenha(app).find('form').trigger('submit');
  await flushPromises();
}
const pedidosDaMaria = (api: ReturnType<typeof criarApiFalsa>) => api.estado.autorizacoes.filter((a) => a.pedido !== 'GET /api/saude');

describe('tela "Senha da organizadora"', () => {
  it('sem senha guardada: o 401 da API mostra a tela, no lugar da página, com o campo já em foco', async () => {
    const { app } = await abrir('/torneios/1', { semSenha: true });
    expect(telaDeSenha(app).exists()).toBe(true);
    expect(textoDe(telaDeSenha(app).find('h1'))).toBe('Senha da organizadora');
    expect(app.text()).not.toContain('Torneio de setembro');
    expect(textoDe(telaDeSenha(app).find(`label[for="${campo(app).attributes('id')}"]`))).toBe('Senha');
    expect(campo(app).attributes('autocomplete')).toBe('current-password');
    expect(document.activeElement).toBe(campo(app).element);
    expect(telaDeSenha(app).findAll('button').map((b) => textoDe(b))).toEqual(['Entrar']);
    expect(botaoSair(app)).toBeUndefined();
  });

  it('senha errada: "Senha incorreta", ligada ao campo, e nada é guardado', async () => {
    const { app } = await abrir('/torneios/1', { semSenha: true });
    await entrar(app, 'senha-errada');
    const alerta = telaDeSenha(app).find('[role="alert"]');
    expect(textoDe(alerta)).toBe('Senha incorreta. Confira e tente de novo.');
    expect(campo(app).attributes('aria-invalid')).toBe('true');
    expect(campo(app).attributes('aria-describedby')).toBe(alerta.attributes('id'));
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
    expect(telaDeSenha(app).exists()).toBe(true);
  });

  it('campo vazio: "Digite a senha.", sem chamar a API', async () => {
    const { app, api } = await abrir('/torneios/1', { semSenha: true });
    const antes = api.estado.pedidos.length;
    await entrar(app, '');
    expect(textoDe(telaDeSenha(app).find('[role="alert"]'))).toBe('Digite a senha.');
    expect(api.estado.pedidos.length).toBe(antes);
  });

  it('senha certa: a página carrega, a senha fica guardada na aba e vai em todo pedido seguinte', async () => {
    const { app, api } = await abrir('/torneios/1', { semSenha: true });
    await entrar(app, SENHA_FALSA);

    expect(telaDeSenha(app).exists()).toBe(false);
    expect(textoDe(app.find('h1'))).toBe('Torneio de setembro');
    expect(sessionStorage.getItem(CHAVE)).toBe(SENHA_FALSA);
    const depois = pedidosDaMaria(api).slice(pedidosDaMaria(api).findIndex((a) => a.pedido === 'GET /api/acesso'));
    expect(depois.length).toBeGreaterThan(1);
    for (const a of depois) expect(a.authorization, a.pedido).toBe(`Bearer ${SENHA_FALSA}`);
    expect(botaoSair(app)).toBeDefined();
  });

  it('"Sair" esquece a senha e volta à tela de senha', async () => {
    const { app } = await abrir('/torneios/1');
    expect(textoDe(app.find('h1'))).toBe('Torneio de setembro');
    await botaoSair(app)!.trigger('click');
    await flushPromises();
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
    expect(telaDeSenha(app).exists()).toBe(true);
    expect(app.text()).not.toContain('Torneio de setembro');
  });

  it('senha guardada que a API não aceita mais (trocaram o .env): tela de senha, e a antiga é esquecida', async () => {
    const { app } = await abrir('/', { senhaGuardada: 'senha-antiga' });
    expect(telaDeSenha(app).exists()).toBe(true);
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
    await entrar(app, SENHA_FALSA);
    expect(app.text()).toContain('Torneio de setembro');
  });

  it('senha com acento: "Senha incorreta" sem chamar a API (o navegador não manda acento num cabeçalho)', async () => {
    const { app, api } = await abrir('/torneios/1', { semSenha: true });
    const antes = api.estado.pedidos.length;
    await entrar(app, 'organização');
    expect(textoDe(telaDeSenha(app).find('[role="alert"]'))).toBe('Senha incorreta. Confira e tente de novo.');
    expect(api.estado.pedidos.length).toBe(antes);
  });
});

describe('páginas por link nunca pedem senha (D11)', () => {
  it.each(['/publico/PublicoPublicoPublicoPublico1234', '/time/CorvosCorvosCorvosCorvosCorvos12'])('%s: sem senha, sem a tela de senha', async (caminho) => {
    const { app } = await abrir(caminho, { semSenha: true });
    expect(telaDeSenha(app).exists()).toBe(false);
    expect(app.text()).toContain('Página não encontrada');
    expect(botaoSair(app)).toBeUndefined();
  });

  it.each(['/publico/PublicoPublicoPublicoPublico1234', '/time/CorvosCorvosCorvosCorvosCorvos12'])('%s: mesmo com a senha guardada, ela não vai no pedido, e não há "Sair"', async (caminho) => {
    const { app, api } = await abrir(caminho);
    const pedidos = pedidosDaMaria(api);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].authorization).toBeNull();
    expect(botaoSair(app)).toBeUndefined();
  });
});
