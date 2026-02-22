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
  status: "scheduled" | "completed" | "cancelled";
  paymentStatus: "pending" | "paid" | "partial";
  expectedAmount: number;
  paidAmount: number;
  isRecurring: boolean;
  notes: string;
}

export interface RecurringPlan {
  id: string;
  patientId: string;
  psychologistId: string;
  dayOfWeek: number; // 0-6
  time: string;
  amount: number;
  active: boolean;
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
