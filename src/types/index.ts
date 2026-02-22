export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  psychologistId: string;
  notes: string;
  createdAt: string;
}

export interface Psychologist {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  sessionRate: number;
  createdAt: string;
}

export interface Session {
  id: string;
  patientId: string;
  psychologistId: string;
  date: string;
  time: string;
  duration: number;
  status: "scheduled" | "completed" | "cancelled";
  paymentStatus: "pending" | "paid" | "partial";
  expectedAmount: number;
  paidAmount: number;
  isRecurring: boolean;
  recurringPlanId?: string;
  invoiceId?: string;
  notes: string;
}

export interface RecurringPlan {
  id: string;
  patientId: string;
  psychologistId: string;
  dayOfWeek: number;
  time: string;
  amount: number;
  active: boolean;
}

export interface Invoice {
  id: string;
  patientId: string;
  psychologistId: string;
  amount: number;
  date: string;
  sessionIds: string[];
  notes: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: "expense" | "income" | "both";
  isDefault: boolean;
  userId?: string;
}

export interface PersonalExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  type: "expense" | "income";
  paymentMethod: string;
  paid: boolean;
}

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  type: "checking" | "savings" | "credit_card";
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "psychologist";
  psychologistId?: string;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
