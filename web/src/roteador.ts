import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import PaginaNovoTorneio from './paginas/PaginaNovoTorneio.vue';
import PaginaTorneio from './paginas/PaginaTorneio.vue';
import PaginaTorneios from './paginas/PaginaTorneios.vue';

// exportadas para os testes montarem as páginas com as mesmas rotas do app
export const rotas: RouteRecordRaw[] = [
  { path: '/', name: 'torneios', component: PaginaTorneios },
  { path: '/torneios/novo', name: 'novo-torneio', component: PaginaNovoTorneio },
  { path: '/torneios/:id(\\d+)', name: 'torneio', component: PaginaTorneio, props: (rota) => ({ id: Number(rota.params.id) }) },
  { path: '/:caminho(.*)*', redirect: '/' },
];

export const roteador = createRouter({ history: createWebHistory(), routes: rotas });
