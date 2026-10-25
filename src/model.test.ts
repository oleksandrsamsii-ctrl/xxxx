import { describe, it, expect } from "vitest";
import {
  newProfile,
  newContract,
  expectedEnd,
  earnings,
  stats,
  endExclusive,
  balances,
  totals,
  forecast,
  initial,
  validateStore,
} from "./model";
describe("civil contract dates", () => {
  it("uses three calendar months, not 90 days", () => {
    expect(expectedEnd("2026-10-18", 3)).toBe("2027-01-18");
    expect(expectedEnd("2024-01-31", 1)).toBe("2024-02-29");
    expect(stats(newContract(), "2026-10-25")).toMatchObject({
      total: 92,
      done: 7,
      left: 85,
    });
  });
  it("clamps before joining and after sign-off", () => {
    const c = newContract();
    expect(stats(c, "2026-09-01").earned).toBe(0);
    expect(stats(c, "2027-03-01").done).toBe(92);
    expect(stats(c, "2027-03-01").left).toBe(0);
  });
  it("sign-off is explicitly excluded unless enabled", () => {
    const c = newContract();
    expect(endExclusive(c)).toBe("2027-01-18");
    expect(stats({ ...c, paidEnd: true }, "2027-02-01").total).toBe(93);
    expect(
      earnings({ ...c, paidEnd: true }, "2027-02-01") -
        earnings(c, "2027-02-01"),
    ).toBeCloseTo(9395 / 31, 2);
  });
  it("actual sign-off overrides expected", () => {
    expect(
      stats({ ...newContract(), actual: "2026-10-28" }, "2026-11-01").total,
    ).toBe(10);
  });
});
describe("salary", () => {
  it("prorates each calendar month independently", () => {
    const c = newContract();
    expect(earnings(c, "2027-01-18")).toBeCloseTo(
      9395 * (14 / 31 + 1 + 1 + 17 / 31),
      2,
    );
    expect(
      earnings({ ...c, start: "2024-02-01", end: "2024-03-01" }, "2024-03-01"),
    ).toBe(9395);
  });
  it("supports fixed 30-day basis including 31-day months", () => {
    expect(
      earnings({ ...newContract(), method: "30" }, "2027-01-18"),
    ).toBeCloseTo((9395 / 30) * 92, 2);
  });
  it("counts only completed days", () => {
    expect(earnings(newContract(), "2026-10-19")).toBeCloseTo(9395 / 31, 2);
  });
});
describe("ledger", () => {
  it("conserves money during internal transfers without expense duplication", () => {
    const p = newProfile();
    p.accounts[0].opening = 1000;
    p.transactions = [
      {
        id: "t",
        date: "2026-10-20",
        type: "transfer",
        amount: 300,
        account: p.accounts[0].id,
        to: p.accounts[1].id,
        category: "",
        description: "",
      },
    ];
    const b = balances(p);
    expect(b[p.accounts[0].id]).toBe(700);
    expect(b[p.accounts[1].id]).toBe(300);
    expect(totals(p, "2026-10-25")).toMatchObject({
      balance: 1000,
      personal: 700,
      family: 300,
      expenses: 0,
      received: 0,
    });
  });
  it("separates salary receipt, earned salary, expenses and reconciliation", () => {
    const p = newProfile();
    const a = p.accounts[0].id;
    p.transactions = [
      {
        id: "a",
        date: "2026-10-20",
        type: "salary",
        amount: 500,
        account: a,
        to: "",
        category: "",
        description: "",
        contractId: p.contract.id,
      },
      {
        id: "b",
        date: "2026-10-21",
        type: "expense",
        amount: 80,
        account: a,
        to: "",
        category: "Food",
        description: "",
      },
      {
        id: "c",
        date: "2026-10-22",
        type: "adjustment",
        amount: -20,
        account: a,
        to: "",
        category: "",
        description: "",
      },
    ];
    expect(totals(p, "2026-10-25")).toMatchObject({
      balance: 400,
      received: 500,
      expenses: 80,
    });
    expect(stats(p.contract, "2026-10-25").earned).not.toBe(500);
    expect(balances(p, "2026-10-19")[a]).toBe(0);
  });
  it("excludes scheduled transactions and previous-contract receipts", () => {
    const p = newProfile();
    p.transactions = [
      {
        id: "a",
        date: "2026-10-20",
        type: "salary",
        amount: 500,
        account: p.accounts[0].id,
        to: "",
        category: "",
        description: "",
        contractId: "previous",
      },
      {
        id: "b",
        date: "2027-01-01",
        type: "expense",
        amount: 80,
        account: p.accounts[0].id,
        to: "",
        category: "",
        description: "",
      },
    ];
    expect(totals(p, "2026-10-25")).toMatchObject({
      balance: 500,
      received: 0,
      expenses: 0,
    });
  });
  it("forecast accounts for prepaid salary without double counting", () => {
    const p = newProfile();
    p.transactions = [
      {
        id: "a",
        date: "2026-10-20",
        type: "salary",
        amount: 40000,
        account: p.accounts[0].id,
        to: "",
        category: "",
        description: "",
        contractId: p.contract.id,
      },
    ];
    p.dailySpend = 10;
    expect(forecast(p, "2026-10-26", "2026-10-25")).toBe(39990);
  });
  it("keeps profiles independent", () => {
    const a = newProfile(),
      b = newProfile();
    a.accounts[0].opening = 100;
    expect(totals(b).balance).toBe(0);
  });
});
describe("backups", () => {
  it("roundtrips all profiles", () => {
    const d = initial();
    expect(validateStore(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it("rejects broken references and invalid financial values", () => {
    const d = initial();
    d.profiles[0].accounts[0].opening = NaN;
    expect(() => validateStore(d)).toThrow();
    expect(() =>
      validateStore({ version: 1, profiles: [], active: "x" }),
    ).toThrow();
  });
});
