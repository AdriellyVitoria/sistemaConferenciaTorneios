/**
 * A senha da organizadora na tela (R3). Fica no sessionStorage: vale para a aba, sobrevive a um
 * F5 e some quando a aba fecha. Também fica na memória, para a tela funcionar mesmo quando o
 * navegador bloqueia o armazenamento (janela anônima, dados bloqueados).
 *
 * `pedeSenha` liga a tela "Senha da organizadora" no lugar da página (App.vue). Quem liga é a
 * chamada à API que recebeu 401, ou o "Sair".
 */
import { ref } from 'vue';

const CHAVE = 'senha-da-organizadora';

function lerDoArmazenamento(): string | null {
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

let senha: string | null = lerDoArmazenamento();

/** A tela de senha está no lugar da página. */
export const pedeSenha = ref(false);
/** Há uma senha guardada: o cabeçalho mostra o "Sair". */
export const temSenha = ref(senha !== null);

export const senhaGuardada = () => senha;

/** Guarda a senha que a API aceitou e tira a tela de senha. */
export function guardarSenha(nova: string) {
  senha = nova;
  temSenha.value = true;
  pedeSenha.value = false;
  try {
    sessionStorage.setItem(CHAVE, nova);
  } catch {
    // sem armazenamento, fica só na memória: vale até recarregar a página
  }
}

/** Esquece a senha, sem mudar a tela. */
export function esquecerSenha() {
  senha = null;
  temSenha.value = false;
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    // nada guardado para apagar
  }
}

/** A API recusou a senha (ou não havia senha): esquece a guardada e pede de novo. */
export function senhaRecusada() {
  esquecerSenha();
  pedeSenha.value = true;
}

/** O botão "Sair" do cabeçalho. */
export const sair = senhaRecusada;
