import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import PaginaDoTime from './paginas/PaginaDoTime.vue';
import PaginaNovoTorneio from './paginas/PaginaNovoTorneio.vue';
import PaginaPublica from './paginas/PaginaPublica.vue';
import PaginaResultado from './paginas/PaginaResultado.vue';
import PaginaTorneio from './paginas/PaginaTorneio.vue';
import PaginaTorneios from './paginas/PaginaTorneios.vue';

// exportadas para os testes montarem as páginas com as mesmas rotas do app
export const rotas: RouteRecordRaw[] = [
  { path: '/', name: 'torneios', component: PaginaTorneios },
  { path: '/torneios/novo', name: 'novo-torneio', component: PaginaNovoTorneio },
  { path: '/torneios/:id(\\d+)', name: 'torneio', component: PaginaTorneio, props: (rota) => ({ id: Number(rota.params.id) }) },
  { path: '/torneios/:id(\\d+)/resultado', name: 'resultado', component: PaginaResultado, props: (rota) => ({ id: Number(rota.params.id) }) },
  // páginas para jogadores (D11): `publica` faz o App esconder o menu e o rodapé, que levam às
  // telas da Maria. O código é opcional para "/publico/" mostrar "Página não encontrada" em vez
  // de cair na regra abaixo, que leva à lista de torneios da Maria.
  { path: '/publico/:codigo?', name: 'publico', component: PaginaPublica, props: (rota) => ({ codigo: String(rota.params.codigo ?? '') }), meta: { publica: true } },
  { path: '/time/:codigo?', name: 'time', component: PaginaDoTime, props: (rota) => ({ codigo: String(rota.params.codigo ?? '') }), meta: { publica: true } },
  { path: '/:caminho(.*)*', redirect: '/' },
];

declare module 'vue-router' {
  interface RouteMeta {
    /** Página para jogadores: sem o menu, sem a marca como link e sem o rodapé do sistema. */
    publica?: boolean;
  }
}

export const roteador = createRouter({ history: createWebHistory(), routes: rotas });
