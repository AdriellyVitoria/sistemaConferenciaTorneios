/**
 * A senha da organizadora nos testes (R3). A mesma do `env` dos dois vitest.config: o módulo
 * `config` lê o ambiente ao ser importado, e a API não sobe sem ADMIN_SENHA.
 */
export const SENHA_DE_TESTE = 'senha-dos-testes';

/** O cabeçalho que as telas da Maria mandam em toda chamada. */
export const COM_SENHA = { authorization: `Bearer ${SENHA_DE_TESTE}` };
