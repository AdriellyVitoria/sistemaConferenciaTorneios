export function formatarCentavos(centavos: number): string {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`Valor em centavos precisa ser inteiro: ${centavos}`);
  }
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const resto = absoluto % 100;
  const reais = (absoluto - resto) / 100;
  const reaisComPontos = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sinal}R$ ${reaisComPontos},${String(resto).padStart(2, '0')}`;
}
