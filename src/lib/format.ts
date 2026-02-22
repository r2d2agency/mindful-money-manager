export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("pt-BR");
}

export const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Cartão de Crédito",
  "Outros",
];

export const PAYMENT_METHODS = [
  "Dinheiro",
  "PIX",
  "Cartão de Débito",
  "Cartão de Crédito",
  "Transferência",
];

export const DAYS_OF_WEEK = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
