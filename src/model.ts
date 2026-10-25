import {
  addMonths,
  format,
  parseISO,
  differenceInCalendarDays,
  addDays,
  getDaysInMonth,
} from "date-fns";
export const iso = (d: Date) => format(d, "yyyy-MM-dd");
// UTC civil date from the current instant; all arithmetic then uses date-only values.
export const today = () => new Date().toISOString().slice(0, 10);
export type Contract = {
  id: string;
  name: string;
  rank: string;
  vessel: string;
  company: string;
  start: string;
  months: number;
  end: string;
  actual: string;
  salary: number;
  method: "calendar" | "30";
  paidEnd: boolean;
};
export type Account = {
  id: string;
  name: string;
  opening: number;
  family: boolean;
};
export type Transaction = {
  id: string;
  date: string;
  type: "salary" | "expense" | "transfer" | "income" | "adjustment";
  amount: number;
  account: string;
  to: string;
  category: string;
  description: string;
  contractId?: string;
};
export type Goal = { id: string; name: string; target: number; saved: number };
export type Profile = {
  id: string;
  name: string;
  contract: Contract;
  history: Contract[];
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  notes: Record<string, { text: string; mood: string }>;
  dailySpend: number;
  monthlyIncome: number;
  monthlySaving: number;
};
export type Store = { version: 1; active: string; profiles: Profile[] };
export const categories = [
  "Переводы семье",
  "Продукты и питание",
  "Дети",
  "Аренда и коммунальные",
  "Авто и топливо",
  "Здоровье",
  "Покупки",
  "Путешествия",
  "Развлечения",
  "Прочее",
];
export const uid = () => crypto.randomUUID();
export function newContract(): Contract {
  return {
    id: uid(),
    name: "Мой контракт",
    rank: "Second Engineer (2/E)",
    vessel: "",
    company: "",
    start: "2026-10-18",
    months: 3,
    end: "2027-01-18",
    actual: "",
    salary: 9395,
    method: "calendar",
    paidEnd: false,
  };
}
export function newProfile(name = "Мой профиль"): Profile {
  return {
    id: uid(),
    name,
    contract: newContract(),
    history: [],
    accounts: [
      { id: uid(), name: "Личный банковский счёт", opening: 0, family: false },
      { id: uid(), name: "Семейный счёт", opening: 0, family: true },
      { id: uid(), name: "Наличные на борту", opening: 0, family: false },
      { id: uid(), name: "Накопления", opening: 0, family: false },
    ],
    transactions: [],
    goals: [],
    notes: {},
    dailySpend: 0,
    monthlyIncome: 0,
    monthlySaving: 0,
  };
}
export function initial(): Store {
  const p = newProfile();
  return { version: 1, active: p.id, profiles: [p] };
}
export const expectedEnd = (start: string, months: number) =>
  iso(addMonths(parseISO(start), months));
export const endExclusive = (c: Contract) =>
  iso(addDays(parseISO(c.actual || c.end), c.paidEnd ? 1 : 0));
export function earnings(c: Contract, until: string) {
  const end = [until, endExclusive(c)].sort()[0];
  let total = 0;
  for (let d = parseISO(c.start); iso(d) < end; d = addDays(d, 1)) {
    total += c.salary / (c.method === "30" ? 30 : getDaysInMonth(d));
  }
  return Math.round(total * 100) / 100;
}
export function stats(c: Contract, now = today()) {
  const end = endExclusive(c);
  const total = Math.max(
    0,
    differenceInCalendarDays(parseISO(end), parseISO(c.start)),
  );
  const done = Math.max(
    0,
    Math.min(total, differenceInCalendarDays(parseISO(now), parseISO(c.start))),
  );
  return {
    total,
    done,
    left: total - done,
    percent: total ? (done / total) * 100 : 0,
    earned: earnings(c, now),
    projected: earnings(c, end),
  };
}
export function balances(p: Profile, until = "9999-12-31") {
  const b = Object.fromEntries(p.accounts.map((a) => [a.id, a.opening]));
  for (const t of p.transactions.filter((t) => t.date <= until)) {
    if (t.type === "transfer") {
      b[t.account] -= t.amount;
      b[t.to] += t.amount;
    } else b[t.account] += (t.type === "expense" ? -1 : 1) * t.amount;
  }
  return b;
}
export function totals(p: Profile, now = today()) {
  const ts = p.transactions.filter((t) => t.date <= now),
    b = balances(p, now);
  return {
    received: ts
      .filter(
        (t) =>
          t.type === "salary" &&
          (t.contractId === p.contract.id ||
            (!t.contractId &&
              t.date >= p.contract.start &&
              t.date < endExclusive(p.contract))),
      )
      .reduce((s, t) => s + t.amount, 0),
    expenses: ts
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0),
    family: ts
      .filter(
        (t) =>
          (t.type === "transfer" &&
            p.accounts.find((a) => a.id === t.to)?.family) ||
          (t.type === "expense" && t.category === categories[0]),
      )
      .reduce((s, t) => s + t.amount, 0),
    balance: Object.values(b).reduce((s, v) => s + v, 0),
    personal: p.accounts
      .filter((a) => !a.family)
      .reduce((s, a) => s + b[a.id], 0),
  };
}
export function forecast(p: Profile, date: string, now = today()) {
  const n = Math.max(
    0,
    differenceInCalendarDays(parseISO(date), parseISO(now)),
  );
  const t = totals(p, now);
  return (
    t.balance +
    Math.max(0, earnings(p.contract, date) - t.received) +
    n * (p.monthlyIncome / 30 - p.dailySpend)
  );
}
export interface StorageAdapter {
  load(): Store;
  save(data: Store): void;
}
export const localAdapter: StorageAdapter = {
  load() {
    const raw = localStorage.getItem("seafarer-v1");
    return raw ? validateStore(JSON.parse(raw)) : initial();
  },
  save(data) {
    localStorage.setItem("seafarer-v1", JSON.stringify(data));
  },
};
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = parseISO(value);
  return (
    !Number.isNaN(date.valueOf()) &&
    iso(date) === value &&
    value >= "1900-01-01" &&
    value <= "2200-12-31"
  );
};
export function validateStore(v: unknown): Store {
  const s = v as Store;
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.profiles) ||
    !s.profiles.length ||
    !s.profiles.some((p) => p?.id === s.active)
  )
    throw Error("Некорректный файл резервной копии");
  const unique = (items: { id: string }[]) =>
    items.every((x) => x && typeof x.id === "string" && x.id.length > 0) &&
    new Set(items.map((x) => x.id)).size === items.length;
  const text = (v: unknown) => typeof v === "string";
  if (!unique(s.profiles)) throw Error("Повторяющиеся профили");
  for (const p of s.profiles) {
    if (
      !text(p.name) ||
      !Array.isArray(p.accounts) ||
      !p.accounts.length ||
      !Array.isArray(p.transactions) ||
      !Array.isArray(p.goals) ||
      !Array.isArray(p.history) ||
      !p.notes ||
      typeof p.notes !== "object" ||
      Array.isArray(p.notes)
    )
      throw Error("Неполные данные профиля");
    for (const c of [p.contract, ...p.history]) {
      if (
        !c ||
        ![c.id, c.name, c.rank, c.vessel, c.company].every(text) ||
        !validDate(c.start) ||
        !validDate(c.end) ||
        (c.actual !== "" && !validDate(c.actual)) ||
        c.end < c.start ||
        (c.actual && c.actual < c.start) ||
        !Number.isInteger(c.months) ||
        c.months < 1 ||
        c.months > 120 ||
        !Number.isFinite(c.salary) ||
        c.salary < 0 ||
        !["calendar", "30"].includes(c.method) ||
        typeof c.paidEnd !== "boolean"
      )
        throw Error("Некорректный контракт");
    }
    if (
      !unique(p.accounts) ||
      p.accounts.some(
        (a) =>
          !text(a.name) ||
          !Number.isFinite(a.opening) ||
          typeof a.family !== "boolean",
      )
    )
      throw Error("Некорректные счета");
    const ai = new Set(p.accounts.map((a) => a.id));
    if (!unique(p.transactions)) throw Error("Повторяющиеся операции");
    for (const t of p.transactions) {
      if (
        !Number.isFinite(t.amount) ||
        !ai.has(t.account) ||
        !["salary", "expense", "transfer", "income", "adjustment"].includes(
          t.type,
        ) ||
        !validDate(t.date) ||
        !text(t.category) ||
        !text(t.description) ||
        (t.type !== "adjustment" && t.amount <= 0) ||
        (t.type === "transfer" && (!ai.has(t.to) || t.to === t.account))
      )
        throw Error("Некорректная операция");
    }
    if (
      !unique(p.goals) ||
      p.goals.some(
        (g) =>
          !text(g.name) ||
          !Number.isFinite(g.target) ||
          g.target <= 0 ||
          !Number.isFinite(g.saved) ||
          g.saved < 0,
      ) ||
      [p.dailySpend, p.monthlyIncome, p.monthlySaving].some(
        (x) => !Number.isFinite(x) || x < 0,
      )
    )
      throw Error("Некорректные суммы");
    for (const [date, note] of Object.entries(p.notes))
      if (!validDate(date) || !note || !text(note.text) || !text(note.mood))
        throw Error("Некорректная заметка");
  }
  return s;
}
