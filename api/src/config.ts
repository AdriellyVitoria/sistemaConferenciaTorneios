import { z } from 'zod';

// Variáveis de ambiente validadas na subida: se faltar algo, a API para com uma mensagem clara.
// Os padrões servem para rodar fora do Docker, apontando para o MySQL do compose (porta 3307).

/** "60000,120000,300000" -> [60000, 120000, 300000]: milissegundos inteiros e positivos. */
const listaDeMilissegundos = z.string().transform((texto, ctx) => {
  const partes = texto.split(',').map((p) => p.trim());
  if (partes.some((p) => !/^\d+$/.test(p) || Number(p) === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `CONFERENCIA_INTERVALOS_MS precisa ser uma lista de milissegundos maiores que zero, separados por vírgula, como "60000,120000,300000,600000". Veio "${texto}".`,
    });
    return z.NEVER;
  }
  return partes.map(Number);
});

const esquema = z
  .object({
    API_PORTA: z.coerce.number().int().positive().default(3000),
    DB_HOST: z.string().min(1).default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(3307),
    MYSQL_DATABASE: z.string().min(1).default('torneios'),
    MYSQL_USER: z.string().min(1).default('torneios'),
    MYSQL_PASSWORD: z.string().min(1).default('torneios'),

    // site oficial (etapa 4)
    SITE_URL: z.string().url().default('http://localhost:4000'),
    /** A maior demora de uma consulta que ainda é normal: 10 s no site real (contexto.md, seção 9). */
    SITE_DEMORA_MAX_MS: z.coerce.number().int().nonnegative().default(10_000),
    /** Depois disso, a consulta conta como "site sem resposta" e é tentada de novo. */
    SITE_TEMPO_LIMITE_MS: z.coerce.number().int().positive().default(15_000),
    /** Espera antes de cada nova tentativa (D10): 1, 2, 5 e depois 10 minutos. */
    CONFERENCIA_INTERVALOS_MS: listaDeMilissegundos.default('60000,120000,300000,600000'),
  })
  .superRefine((c, ctx) => {
    // com o tempo limite abaixo da demora normal, uma consulta lenta mas certa viraria falha
    if (c.SITE_TEMPO_LIMITE_MS <= c.SITE_DEMORA_MAX_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SITE_TEMPO_LIMITE_MS'],
        message: `SITE_TEMPO_LIMITE_MS (${c.SITE_TEMPO_LIMITE_MS}) precisa ser maior que a demora máxima do site, SITE_DEMORA_MAX_MS (${c.SITE_DEMORA_MAX_MS}).`,
      });
    }
  });

export type Config = z.infer<typeof esquema>;

/** Lê e valida a configuração; separado do process.env para os testes. */
export function lerConfig(ambiente: Record<string, string | undefined>): Config {
  const lido = esquema.safeParse(ambiente);
  if (!lido.success) {
    const problemas = lido.error.issues.map((i) => '- ' + i.message).join('\n');
    throw new Error(`Configuração inválida:\n${problemas}`);
  }
  return lido.data;
}

export const config = lerConfig(process.env);
