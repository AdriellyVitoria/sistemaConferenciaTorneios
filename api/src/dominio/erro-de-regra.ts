/**
 * Uma regra de negócio impediu a conta, e a mensagem é uma frase para a Maria (code review, item 4).
 * Ex.: "O time Lobos tem prêmio, mas nenhum minuto nem kill registrado no site: não há como dividir."
 *
 * O cálculo devolve essa frase com 409, em vez do "Erro inesperado no servidor" do 500. Proteções
 * de programação (valor que não é inteiro, nome repetido) continuam como Error comum: são bug, e o
 * 500 é a resposta certa para elas.
 */
export class ErroDeRegra extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeRegra';
  }
}
