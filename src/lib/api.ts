import type {
  Patient, Psychologist, Session, RecurringPlan,
  PersonalExpense, BankAccount, AuthResponse, User, Invoice, Category
} from "@/types";

const API_URL = import.meta.env.VITE_API_URL || "https://blaster-psi-backend.isyhhh.easypanel.host/api";

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erro desconhecido" }));
    throw new Error(err.message || `Erro ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ===== AUTH =====
export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("auth_token", data.token);
  localStorage.setItem("auth_user", JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  window.location.href = "/login";
}

export function getStoredUser(): User | null {
  try {
    const data = localStorage.getItem("auth_user");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ===== PATIENTS =====
export const fetchPatients = () => request<Patient[]>("/patients");
export const createPatient = (data: Omit<Patient, "id" | "createdAt">) =>
  request<Patient>("/patients", { method: "POST", body: JSON.stringify(data) });
export const updatePatient = (id: string, data: Partial<Patient>) =>
  request<Patient>(`/patients/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deletePatient = (id: string) =>
  request<void>(`/patients/${id}`, { method: "DELETE" });

// ===== PSYCHOLOGISTS =====
export const fetchPsychologists = () => request<Psychologist[]>("/psychologists");
export const createPsychologist = (data: Omit<Psychologist, "id" | "createdAt">) =>
  request<Psychologist>("/psychologists", { method: "POST", body: JSON.stringify(data) });
export const updatePsychologist = (id: string, data: Partial<Psychologist>) =>
  request<Psychologist>(`/psychologists/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deletePsychologist = (id: string) =>
  request<void>(`/psychologists/${id}`, { method: "DELETE" });

// ===== SESSIONS =====
export const fetchSessions = () => request<Session[]>("/sessions");
export const createSession = (data: Omit<Session, "id">) =>
  request<Session>("/sessions", { method: "POST", body: JSON.stringify(data) });
export const updateSession = (id: string, data: Partial<Session>) =>
  request<Session>(`/sessions/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteSession = (id: string) =>
  request<void>(`/sessions/${id}`, { method: "DELETE" });

// ===== RECURRING PLANS =====
export const fetchRecurringPlans = () => request<RecurringPlan[]>("/recurring-plans");
export const createRecurringPlan = (data: Omit<RecurringPlan, "id">) =>
  request<RecurringPlan>("/recurring-plans", { method: "POST", body: JSON.stringify(data) });
export const deleteRecurringPlan = (id: string) =>
  request<void>(`/recurring-plans/${id}`, { method: "DELETE" });
export const generateRecurringSessions = (planId: string, weeks: number) =>
  request<Session[]>(`/recurring-plans/${planId}/generate`, { method: "POST", body: JSON.stringify({ weeks }) });

// ===== INVOICES =====
export const fetchInvoices = () => request<Invoice[]>("/invoices");
export const createInvoice = (data: { patientId: string; psychologistId: string; amount: number; date: string; sessionIds: string[]; notes?: string }) =>
  request<Invoice>("/invoices", { method: "POST", body: JSON.stringify(data) });
export const deleteInvoice = (id: string) =>
  request<void>(`/invoices/${id}`, { method: "DELETE" });

// ===== CATEGORIES =====
export const fetchCategories = () => request<Category[]>("/categories");
export const createCategory = (data: { name: string; type: string }) =>
  request<Category>("/categories", { method: "POST", body: JSON.stringify(data) });

// ===== SETTINGS (branding) =====
export const fetchSettings = () => request<Record<string, string>>("/settings");
export const updateSettings = (data: Record<string, string>) =>
  request<Record<string, string>>("/settings", { method: "PUT", body: JSON.stringify(data) });
export const deleteCategory = (id: string) =>
  request<void>(`/categories/${id}`, { method: "DELETE" });

// ===== PERSONAL EXPENSES =====
export const fetchPersonalExpenses = () => request<PersonalExpense[]>("/personal-expenses");
export const createPersonalExpense = (data: Omit<PersonalExpense, "id">) =>
  request<PersonalExpense>("/personal-expenses", { method: "POST", body: JSON.stringify(data) });
export const updatePersonalExpense = (id: string, data: Partial<PersonalExpense>) =>
  request<PersonalExpense>(`/personal-expenses/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deletePersonalExpense = (id: string) =>
  request<void>(`/personal-expenses/${id}`, { method: "DELETE" });

// ===== BANK ACCOUNTS =====
export const fetchBankAccounts = () => request<BankAccount[]>("/bank-accounts");
export const createBankAccount = (data: Omit<BankAccount, "id">) =>
  request<BankAccount>("/bank-accounts", { method: "POST", body: JSON.stringify(data) });
export const updateBankAccount = (id: string, data: Partial<BankAccount>) =>
  request<BankAccount>(`/bank-accounts/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteBankAccount = (id: string) =>
  request<void>(`/bank-accounts/${id}`, { method: "DELETE" });

// ===== USERS (admin only) =====
export const fetchUsers = () => request<User[]>("/users");
export const createUser = (data: { email: string; password: string; name: string; role: "admin" | "psychologist"; psychologistId?: string }) =>
  request<User>("/users", { method: "POST", body: JSON.stringify(data) });
export const updateUser = (id: string, data: { name?: string; email?: string; role?: string; psychologistId?: string }) =>
  request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const resetUserPassword = (id: string, password: string) =>
  request<{ message: string }>(`/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) });
export const deleteUser = (id: string) =>
  request<void>(`/users/${id}`, { method: "DELETE" });
