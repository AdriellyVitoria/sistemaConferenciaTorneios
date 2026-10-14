import { createRouter, createWebHistory } from 'vue-router';
import PaginaNovoTorneio from './paginas/PaginaNovoTorneio.vue';
import PaginaTorneio from './paginas/PaginaTorneio.vue';
import PaginaTorneios from './paginas/PaginaTorneios.vue';

export const roteador = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'torneios', component: PaginaTorneios },
    { path: '/torneios/novo', name: 'novo-torneio', component: PaginaNovoTorneio },
    { path: '/torneios/:id(\\d+)', name: 'torneio', component: PaginaTorneio, props: (rota) => ({ id: Number(rota.params.id) }) },
    { path: '/:caminho(.*)*', redirect: '/' },
  ],
});
