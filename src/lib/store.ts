import { Patient, Psychologist, Session, PersonalExpense, BankAccount, RecurringPlan } from "@/types";

function getStore<T>(key: string, fallback: T[]): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function setStore<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

function generateId() {
  return crypto.randomUUID();
}

// ===== PATIENTS =====
export function getPatients(): Patient[] {
  return getStore<Patient>("patients", []);
}
export function savePatient(p: Omit<Patient, "id" | "createdAt">): Patient {
  const patients = getPatients();
  const newP: Patient = { ...p, id: generateId(), createdAt: new Date().toISOString() };
  patients.push(newP);
  setStore("patients", patients);
  return newP;
}
export function updatePatient(id: string, data: Partial<Patient>) {
  const patients = getPatients().map(p => p.id === id ? { ...p, ...data } : p);
  setStore("patients", patients);
}
export function deletePatient(id: string) {
  setStore("patients", getPatients().filter(p => p.id !== id));
}

// ===== PSYCHOLOGISTS =====
export function getPsychologists(): Psychologist[] {
  return getStore<Psychologist>("psychologists", []);
}
export function savePsychologist(p: Omit<Psychologist, "id" | "createdAt">): Psychologist {
  const list = getPsychologists();
  const newP: Psychologist = { ...p, id: generateId(), createdAt: new Date().toISOString() };
  list.push(newP);
  setStore("psychologists", list);
  return newP;
}
export function updatePsychologist(id: string, data: Partial<Psychologist>) {
  const list = getPsychologists().map(p => p.id === id ? { ...p, ...data } : p);
  setStore("psychologists", list);
}
export function deletePsychologist(id: string) {
  setStore("psychologists", getPsychologists().filter(p => p.id !== id));
}

// ===== SESSIONS =====
export function getSessions(): Session[] {
  return getStore<Session>("sessions", []);
}
export function saveSession(s: Omit<Session, "id">): Session {
  const list = getSessions();
  const newS: Session = { ...s, id: generateId() };
  list.push(newS);
  setStore("sessions", list);
  return newS;
}
export function updateSession(id: string, data: Partial<Session>) {
  const list = getSessions().map(s => s.id === id ? { ...s, ...data } : s);
  setStore("sessions", list);
}
export function deleteSession(id: string) {
  setStore("sessions", getSessions().filter(s => s.id !== id));
}

// ===== RECURRING PLANS =====
export function getRecurringPlans(): RecurringPlan[] {
  return getStore<RecurringPlan>("recurringPlans", []);
}
export function saveRecurringPlan(p: Omit<RecurringPlan, "id">): RecurringPlan {
  const list = getRecurringPlans();
  const newP: RecurringPlan = { ...p, id: generateId() };
  list.push(newP);
  setStore("recurringPlans", list);
  return newP;
}
export function deleteRecurringPlan(id: string) {
  setStore("recurringPlans", getRecurringPlans().filter(p => p.id !== id));
}

// ===== PERSONAL EXPENSES =====
export function getPersonalExpenses(): PersonalExpense[] {
  return getStore<PersonalExpense>("personalExpenses", []);
}
export function savePersonalExpense(e: Omit<PersonalExpense, "id">): PersonalExpense {
  const list = getPersonalExpenses();
  const newE: PersonalExpense = { ...e, id: generateId() };
  list.push(newE);
  setStore("personalExpenses", list);
  return newE;
}
export function updatePersonalExpense(id: string, data: Partial<PersonalExpense>) {
  const list = getPersonalExpenses().map(e => e.id === id ? { ...e, ...data } : e);
  setStore("personalExpenses", list);
}
export function deletePersonalExpense(id: string) {
  setStore("personalExpenses", getPersonalExpenses().filter(e => e.id !== id));
}

// ===== BANK ACCOUNTS =====
export function getBankAccounts(): BankAccount[] {
  return getStore<BankAccount>("bankAccounts", []);
}
export function saveBankAccount(a: Omit<BankAccount, "id">): BankAccount {
  const list = getBankAccounts();
  const newA: BankAccount = { ...a, id: generateId() };
  list.push(newA);
  setStore("bankAccounts", list);
  return newA;
}
export function updateBankAccount(id: string, data: Partial<BankAccount>) {
  const list = getBankAccounts().map(a => a.id === id ? { ...a, ...data } : a);
  setStore("bankAccounts", list);
}
export function deleteBankAccount(id: string) {
  setStore("bankAccounts", getBankAccounts().filter(a => a.id !== id));
}
