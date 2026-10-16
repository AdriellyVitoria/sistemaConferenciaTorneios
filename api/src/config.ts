import { z } from 'zod';

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

const senhaDaOrganizadora = z
  .string({ required_error: 'ADMIN_SENHA não foi definida: é a senha das telas da organizadora. Defina no .env (veja o .env.example) ou, fora do Docker, no ambiente.' })
  .min(8, 'ADMIN_SENHA precisa ter pelo menos 8 caracteres.')
  .regex(/^[\x20-\x7e]*$/, 'ADMIN_SENHA só pode ter letras sem acento, números e símbolos (o navegador não manda acento num cabeçalho).')
  .refine((s) => s.trim() === s, 'ADMIN_SENHA não pode começar nem terminar com espaço.');

const esquema = z
  .object({
    API_PORTA: z.coerce.number().int().positive().default(3000),
    ADMIN_SENHA: senhaDaOrganizadora,
    DB_HOST: z.string().min(1).default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(3307),
    MYSQL_DATABASE: z.string().min(1).default('torneios'),
    MYSQL_USER: z.string().min(1).default('torneios'),
    MYSQL_PASSWORD: z.string().min(1).default('torneios'),

    SITE_URL: z.string().url().default('http://localhost:4000'),
    SITE_DEMORA_MAX_MS: z.coerce.number().int().nonnegative().default(10_000),
    SITE_TEMPO_LIMITE_MS: z.coerce.number().int().positive().default(15_000),
    CONFERENCIA_INTERVALOS_MS: listaDeMilissegundos.default('60000,120000,300000,600000'),

    CONFERENCIA_ACORDAR_A_CADA_MS: z.coerce.number().int().positive().default(5_000),
    CONFERENCIA_LOTE: z.coerce.number().int().positive().default(3),
    CONFERENCIA_PRESA_APOS_MS: z.coerce.number().int().positive().default(120_000),
  })
  .superRefine((c, ctx) => {
    if (c.SITE_TEMPO_LIMITE_MS <= c.SITE_DEMORA_MAX_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SITE_TEMPO_LIMITE_MS'],
        message: `SITE_TEMPO_LIMITE_MS (${c.SITE_TEMPO_LIMITE_MS}) precisa ser maior que a demora máxima do site, SITE_DEMORA_MAX_MS (${c.SITE_DEMORA_MAX_MS}).`,
      });
    }
    if (c.CONFERENCIA_PRESA_APOS_MS <= c.SITE_TEMPO_LIMITE_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CONFERENCIA_PRESA_APOS_MS'],
        message: `CONFERENCIA_PRESA_APOS_MS (${c.CONFERENCIA_PRESA_APOS_MS}) precisa ser maior que o tempo limite da consulta, SITE_TEMPO_LIMITE_MS (${c.SITE_TEMPO_LIMITE_MS}).`,
      });
    }
  });

export type Config = z.infer<typeof esquema>;

export function lerConfig(ambiente: Record<string, string | undefined>): Config {
  const lido = esquema.safeParse(ambiente);
  if (!lido.success) {
    const problemas = lido.error.issues.map((i) => '- ' + i.message).join('\n');
    throw new Error(`Configuração inválida:\n${problemas}`);
  }
  return lido.data;
}

export const config = lerConfig(process.env);
