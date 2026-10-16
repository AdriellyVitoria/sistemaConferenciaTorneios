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

export const pedeSenha = ref(false);
export const temSenha = ref(senha !== null);

export const senhaGuardada = () => senha;

export function guardarSenha(nova: string) {
  senha = nova;
  temSenha.value = true;
  pedeSenha.value = false;
  try {
    sessionStorage.setItem(CHAVE, nova);
  } catch {
  }
}

export function esquecerSenha() {
  senha = null;
  temSenha.value = false;
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
  }
}

export function senhaRecusada() {
  esquecerSenha();
  pedeSenha.value = true;
}

export const sair = senhaRecusada;
