import { useState, useEffect, type ReactNode } from "react";
import {
  Anchor,
  LayoutDashboard,
  CalendarDays,
  ArrowLeftRight,
  Wallet,
  Target,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Sun,
  Moon,
  Download,
  Upload,
  Ship,
  Check,
  ArrowRight,
  TrendingUp,
  Globe,
  X,
  Trash2,
  Pencil,
  Compass,
} from "lucide-react";
import {
  addMonths,
  parseISO,
  format,
  startOfMonth,
  endOfMonth,
  addDays,
  getDay,
  differenceInCalendarDays,
} from "date-fns";
import { ru, enUS } from "date-fns/locale";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  type Profile,
  type Contract,
  type Transaction,
  type Goal,
  type Account,
  type Store,
  uid,
  today,
  iso,
  newProfile,
  newContract,
  initial,
  localAdapter,
  validateStore,
  categories,
  expectedEnd,
  stats,
  totals,
  balances,
  forecast,
  earnings,
  endExclusive,
} from "./model";
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
const navigation = [
  ["Обзор", "Overview", LayoutDashboard],
  ["Календарь", "Calendar", CalendarDays],
  ["Операции", "Transactions", ArrowLeftRight],
  ["Счета", "Accounts", Wallet],
  ["Цели", "Goals", Target],
  ["История контрактов", "Contract history", History],
  ["Настройки", "Settings", Settings],
] as const;
function preference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export default function App() {
  const [loadError, setLoadError] = useState(() => {
    try {
      const raw = localStorage.getItem("seafarer-v1");
      if (raw) validateStore(JSON.parse(raw));
      return "";
    } catch {
      return "Сохранённые данные повреждены. Восстановите JSON-копию в настройках. Данные не перезаписаны.";
    }
  });
  const [data, setData] = useState<Store>(() => {
    try {
      return localAdapter.load();
    } catch {
      return initial();
    }
  });
  const [page, setPage] = useState(0);
  const [en, setEn] = useState(preference("seafarer-lang") === "en");
  const [dark, setDark] = useState(preference("seafarer-theme") === "dark");
  const [modal, setModal] = useState<ReactNode>(null);
  const [month, setMonth] = useState(startOfMonth(parseISO(today())));
  const [revision, setRevision] = useState(today());
  const [filter, setFilter] = useState("");
  const [forecastDate, setForecastDate] = useState(
    data.profiles.find((p) => p.id === data.active)!.contract.end,
  );
  const p = data.profiles.find((x) => x.id === data.active)!;
  const c = p.contract,
    s = stats(c, revision),
    t = totals(p, revision),
    b = balances(p, revision);
  const tr = (r: string, e: string) => (en ? e : r);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("seafarer-v1");
      if (raw) validateStore(JSON.parse(raw));
    } catch {
      setLoadError(
        "Сохранённые данные повреждены. Они не перезаписаны. Восстановите JSON-копию в настройках.",
      );
    }
  }, []);
  useEffect(() => {
    if (loadError) return;
    try {
      localAdapter.save(data);
    } catch {
      setLoadError(
        "Не удалось сохранить данные. Экспортируйте JSON-копию; проверьте свободное место браузера.",
      );
    }
  }, [data, loadError]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("seafarer-theme", dark ? "dark" : "light");
    } catch {
      /* Main storage warning covers unavailable storage. */
    }
  }, [dark]);
  useEffect(() => {
    try {
      localStorage.setItem("seafarer-lang", en ? "en" : "ru");
    } catch {
      /* Main storage warning covers unavailable storage. */
    }
    document.documentElement.lang = en ? "en" : "ru";
  }, [en]);
  useEffect(() => {
    const id = setInterval(() => setRevision(today()), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  function update(fn: (p: Profile) => Profile) {
    setData((d) => ({
      ...d,
      profiles: d.profiles.map((x) => (x.id === d.active ? fn(x) : x)),
    }));
  }
  function dialog(title: string, body: ReactNode) {
    setModal(
      <div
        className="modal-box"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="section-title">
          <h2>{title}</h2>
          <button className="icon" onClick={() => setModal(null)}>
            <X size={20} />
          </button>
        </div>
        {body}
      </div>,
    );
  }
  function field(
    label: string,
    name: string,
    value: string | number,
    type = "text",
    required = true,
  ) {
    return (
      <label>
        {label}
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          min={type === "number" ? (name === "months" ? 1 : 0) : undefined}
          step={
            type === "number" ? (name === "months" ? "1" : "0.01") : undefined
          }
        />
      </label>
    );
  }
  function contractForm() {
    dialog(
      tr("Параметры контракта", "Contract settings"),
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            start = String(f.get("start")),
            months = Number(f.get("months")),
            end = String(f.get("end")) || expectedEnd(start, months),
            actual = String(f.get("actual"));
          if (!Number.isInteger(months) || months < 1 || months > 120)
            return alert(
              tr(
                "Срок: от 1 до 120 целых месяцев",
                "Duration: 1–120 whole months",
              ),
            );
          if (end < start || (actual && actual < start))
            return alert(
              tr("Дата окончания раньше начала", "End date precedes start"),
            );
          update((q) => ({
            ...q,
            contract: {
              ...q.contract,
              name: String(f.get("name")),
              rank: String(f.get("rank")),
              vessel: String(f.get("vessel")),
              company: String(f.get("company")),
              start,
              months,
              end,
              actual,
              salary: Number(f.get("salary")),
              method: f.get("method") as Contract["method"],
              paidEnd: f.get("paidEnd") === "on",
            },
          }));
          setModal(null);
        }}
      >
        <div className="form-grid">
          {field(tr("Название", "Title"), "name", c.name)}
          {field(tr("Должность", "Rank"), "rank", c.rank)}
          {field(tr("Судно", "Vessel"), "vessel", c.vessel, "text", false)}
          {field(
            tr("Компания", "Company"),
            "company",
            c.company,
            "text",
            false,
          )}
          {field(tr("Дата посадки", "Joining date"), "start", c.start, "date")}
          {field(
            tr("Месяцев (календарных)", "Calendar months"),
            "months",
            c.months,
            "number",
          )}
          {field(
            tr(
              "Окончание (пусто: автоматически)",
              "Sign-off (blank: automatic)",
            ),
            "end",
            c.end,
            "date",
            false,
          )}
          {field(
            tr("Фактическое окончание", "Actual sign-off"),
            "actual",
            c.actual,
            "date",
            false,
          )}
          {field(
            tr("Месячная зарплата, USD", "Monthly salary, USD"),
            "salary",
            c.salary,
            "number",
          )}
          <label>
            {tr("Расчёт зарплаты", "Salary method")}
            <select name="method" defaultValue={c.method}>
              <option value="calendar">
                {tr("По дням календарного месяца", "Calendar-month prorating")}
              </option>
              <option value="30">
                {tr("Фиксированный месяц: 30 дней", "Fixed 30-day basis")}
              </option>
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" name="paidEnd" defaultChecked={c.paidEnd} />
          {tr("Оплачивать день списания", "Include sign-off as a paid day")}
        </label>
        <p className="muted">
          {tr(
            "Для пересчёта по сроку очистите ожидаемую дату окончания. Начисления показываются за завершённые дни UTC.",
            "Clear sign-off to recalculate from duration. Earnings use completed UTC days.",
          )}
        </p>
        <button className="primary">
          {tr("Сохранить контракт", "Save contract")}
        </button>
      </form>,
    );
  }
  function transactionForm(existing?: Transaction) {
    dialog(
      tr(
        existing ? "Редактировать операцию" : "Новая операция",
        existing ? "Edit transaction" : "New transaction",
      ),
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const tx: Transaction = {
            contractId: existing?.contractId || p.contract.id,
            id: existing?.id || uid(),
            date: String(f.get("date")),
            type: f.get("type") as Transaction["type"],
            amount: Number(f.get("amount")),
            account: String(f.get("account")),
            to: String(f.get("to")),
            category: String(f.get("category")),
            description: String(f.get("description")),
          };
          if (tx.type === "transfer" && tx.account === tx.to)
            return alert(
              tr("Выберите разные счета", "Choose different accounts"),
            );
          if (!Number.isFinite(tx.amount) || tx.amount <= 0) return;
          update((q) => ({
            ...q,
            transactions: [...q.transactions.filter((a) => a.id !== tx.id), tx],
          }));
          setModal(null);
        }}
      >
        <div className="form-grid">
          <label>
            {tr("Тип", "Type")}
            <select name="type" defaultValue={existing?.type || "expense"}>
              <option value="expense">{tr("Расход", "Expense")}</option>
              <option value="salary">
                {tr("Получена зарплата", "Salary received")}
              </option>
              <option value="transfer">
                {tr("Между счетами", "Internal transfer")}
              </option>
              <option value="income">
                {tr("Другой доход", "Other income")}
              </option>
            </select>
          </label>
          {field(
            tr("Сумма, USD", "Amount, USD"),
            "amount",
            existing?.amount || "",
            "number",
          )}
          {field(
            tr("Дата", "Date"),
            "date",
            existing?.date || revision,
            "date",
          )}
          <label>
            {tr("Счёт", "Account")}
            <select name="account" defaultValue={existing?.account}>
              {p.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("На счёт (для перевода)", "Destination (transfer)")}
            <select name="to" defaultValue={existing?.to || p.accounts[1]?.id}>
              {p.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Категория (можно свою)", "Category (custom allowed)")}
            <input
              name="category"
              list="categories"
              defaultValue={existing?.category || categories[1]}
              required
            />
            <datalist id="categories">
              {categories.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </datalist>
          </label>
        </div>
        {field(
          tr("Описание", "Description"),
          "description",
          existing?.description || "",
          "text",
          false,
        )}
        <p className="muted">
          {tr(
            "Перевод между счетами не является расходом. Перевод вне ваших счетов записывайте как расход «Переводы семье».",
            "Internal transfers are not expenses. Transfers outside your accounts are family expenses.",
          )}
        </p>
        <button className="primary">
          {tr("Сохранить операцию", "Save transaction")}
        </button>
      </form>,
    );
  }
  function accountForm(a?: Account) {
    dialog(
      tr("Банковский счёт", "Account"),
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            account: Account = {
              id: a?.id || uid(),
              name: String(f.get("name")),
              opening: Number(f.get("opening")),
              family: f.get("family") === "on",
            };
          update((q) => ({
            ...q,
            accounts: [
              ...q.accounts.filter((x) => x.id !== account.id),
              account,
            ],
          }));
          setModal(null);
        }}
      >
        {field(tr("Название", "Name"), "name", a?.name || "")}
        {field(
          tr("Начальный остаток, USD", "Opening balance, USD"),
          "opening",
          a?.opening || 0,
          "number",
        )}
        <label className="check">
          <input type="checkbox" name="family" defaultChecked={a?.family} />
          {tr("Семейный счёт", "Family account")}
        </label>
        <button className="primary">{tr("Сохранить", "Save")}</button>
      </form>,
    );
  }
  function goalForm(g?: Goal) {
    dialog(
      tr("Цель накопления", "Savings goal"),
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            goal: Goal = {
              id: g?.id || uid(),
              name: String(f.get("name")),
              target: Number(f.get("target")),
              saved: Number(f.get("saved")),
            };
          if (goal.target <= 0) return;
          update((q) => ({
            ...q,
            goals: [...q.goals.filter((x) => x.id !== goal.id), goal],
          }));
          setModal(null);
        }}
      >
        {field(
          tr(
            "Название: автомобиль, квартира, отпуск…",
            "Name: car, apartment, vacation…",
          ),
          "name",
          g?.name || "",
        )}
        {field(
          tr("Целевая сумма, USD", "Target, USD"),
          "target",
          g?.target || "",
          "number",
        )}
        {field(
          tr("Накоплено (выделено на цель), USD", "Saved (allocated), USD"),
          "saved",
          g?.saved || 0,
          "number",
        )}
        <p className="muted">
          {tr(
            "Учёт цели не меняет остатки счетов. Ежемесячный план накоплений задаётся в прогнозе.",
            "Goals do not change account balances. Set monthly savings in the forecast.",
          )}
        </p>
        <button className="primary">{tr("Сохранить", "Save")}</button>
      </form>,
    );
  }
  function backup() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    a.download = "seafarer-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function excel() {
    try {
      const { default: ExcelJS } = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const append = (name: string, rows: object[]) => {
        const sheet = wb.addWorksheet(name);
        if (!rows.length) return;
        const keys = Object.keys(rows[0]);
        sheet.columns = keys.map((key) => ({ header: key, key, width: 22 }));
        sheet.addRows(rows);
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: "frozen", ySplit: 1 }];
      };
      append("Contracts", [c, ...p.history]);
      let days = [];
      for (
        let d = parseISO(c.start);
        iso(d) < endExclusive(c);
        d = addDays(d, 1)
      )
        days.push({
          date: iso(d),
          salary: earnings({ ...c, start: iso(d) }, iso(addDays(d, 1))),
        });
      append("Salary", days);
      append(
        "Transactions",
        p.transactions.map((x) => ({
          ...x,
          account: p.accounts.find((a) => a.id === x.account)?.name,
          to: p.accounts.find((a) => a.id === x.to)?.name || "",
        })),
      );
      append(
        "Accounts",
        p.accounts.map((a) => ({ ...a, balance: b[a.id] })),
      );
      append("Report", [
        { date: revision, ...s, ...t, forecast: forecast(p, c.end) },
      ]);
      append("Goals", p.goals);
      append(
        "Backup",
        (JSON.stringify(data).match(/[\s\S]{1,30000}/g) || []).map(
          (json, index) => ({ index, json }),
        ),
      );
      const buffer = await wb.xlsx.writeBuffer();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      a.download = "seafarer-report.xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (error) {
      console.error("Excel export failed", error);
      alert(
        tr(
          "Не удалось создать Excel. Используйте JSON-копию.",
          "Excel export failed. Use a JSON backup.",
        ),
      );
    }
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw Error("Максимальный размер файла: 10 MB");
      let raw;
      if (file.name.endsWith(".xlsx")) {
        const { default: ExcelJS } = await import("exceljs");
        const w = new ExcelJS.Workbook();
        await w.xlsx.load(await file.arrayBuffer());
        const sheet = w.getWorksheet("Backup");
        if (!sheet) throw Error("Нет листа Backup");
        const chunks: string[] = [];
        sheet.eachRow((row, i) => {
          if (i > 1) chunks.push(String(row.getCell(2).value || ""));
        });
        raw = JSON.parse(chunks.join(""));
      } else raw = JSON.parse(await file.text());
      const next = validateStore(raw);
      if (
        !confirm(
          tr(
            "Заменить все профили данными из файла? Сначала экспортируйте текущие данные.",
            "Replace all profiles? Export current data first.",
          ),
        )
      )
        return;
      localAdapter.save(next);
      setLoadError("");
      setData(next);
    } catch (err) {
      alert(
        tr("Импорт не выполнен: ", "Import failed: ") +
          (err instanceof Error ? err.message : "invalid file"),
      );
    }
  }
  const chart = Array.from({ length: 7 }, (_, i) => {
    const date = iso(addDays(parseISO(c.start), Math.round((s.total * i) / 6)));
    return {
      date: format(parseISO(date), "dd MMM", { locale: en ? enUS : ru }),
      earned: earnings(c, date),
      forecast: forecast(p, date, c.start),
    };
  });
  function card(
    label: string,
    value: string,
    icon: ReactNode,
    sub: string,
    accent = false,
  ) {
    return (
      <div className={"stat-card " + (accent ? "accent" : "")}>
        <div className="stat-label">
          {label}
          <span className="stat-icon">{icon}</span>
        </div>
        <div className="stat-value">{value}</div>
        <div className="stat-sub">{sub}</div>
      </div>
    );
  }
  function txList(limit?: number) {
    const rows = [...p.transactions]
      .filter(
        (x) =>
          !filter ||
          `${x.description} ${x.category} ${x.date}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
    return rows.length ? (
      <div className="transactions">
        {rows.map((x) => (
          <div className="transaction" key={x.id}>
            <div className={"tx-icon " + x.type}>
              {x.type === "expense" ? (
                <ArrowUpRight size={20} />
              ) : x.type === "transfer" ? (
                <ArrowLeftRight size={20} />
              ) : (
                <ArrowDownLeft size={20} />
              )}
            </div>
            <div className="tx-info">
              <strong>
                {x.description ||
                  x.category ||
                  tr("Корректировка", "Adjustment")}
              </strong>
              <small>
                {p.accounts.find((a) => a.id === x.account)?.name} · {x.date}
                {x.date > revision
                  ? " · " + tr("Запланировано", "Scheduled")
                  : ""}
              </small>
            </div>
            <strong
              className={
                x.type === "salary" || x.type === "income" ? "positive" : ""
              }
            >
              {x.type === "expense" ? "−" : x.type === "transfer" ? "" : "+"}
              {money(x.amount)}
            </strong>
            <button
              className="icon"
              title={tr("Редактировать", "Edit")}
              onClick={() =>
                x.type === "adjustment"
                  ? alert(
                      tr(
                        "Удалите корректировку и выполните сверку заново",
                        "Delete and reconcile again",
                      ),
                    )
                  : transactionForm(x)
              }
            >
              <Pencil size={14} />
            </button>
            <button
              className="icon"
              title={tr("Удалить", "Delete")}
              onClick={() => {
                if (confirm(tr("Удалить операцию?", "Delete transaction?")))
                  update((q) => ({
                    ...q,
                    transactions: q.transactions.filter((y) => y.id !== x.id),
                  }));
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    ) : (
      <div className="empty">
        <ArrowLeftRight />
        <h3>
          {tr(
            "Здесь начинается ваша финансовая история",
            "Your financial story starts here",
          )}
        </h3>
        <p>
          {tr(
            "Добавьте полученную зарплату, расход или перевод.",
            "Add salary received, an expense or a transfer.",
          )}
        </p>
        <button className="secondary" onClick={() => transactionForm()}>
          <Plus size={16} />
          {tr("Добавить операцию", "Add transaction")}
        </button>
      </div>
    );
  }
  const calendar = (
    <section className="panel">
      <div className="section-title">
        <h3>{tr("Календарь контракта", "Contract calendar")}</h3>
        <div className="month-switch">
          <button
            className="icon"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeft size={17} />
          </button>
          <strong>
            {format(month, "LLLL yyyy", { locale: en ? enUS : ru })}
          </strong>
          <button
            className="icon"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="calendar">
        {(en
          ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
          : ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        ).map((x) => (
          <div className="weekday" key={x}>
            {x}
          </div>
        ))}
        {Array.from({ length: (getDay(month) + 6) % 7 }, (_, i) => (
          <div key={"blank" + i} />
        ))}
        {Array.from(
          { length: Number(format(endOfMonth(month), "d")) },
          (_, i) => {
            const date = iso(addDays(month, i)),
              on = date >= c.start && date < endExclusive(c),
              done = on && date < revision;
            return (
              <button
                key={date}
                className={
                  "day " +
                  (done ? "done " : "") +
                  (on && !done ? "onboard " : "") +
                  (date === revision ? "today " : "")
                }
                onClick={() =>
                  dialog(
                    format(parseISO(date), "dd MMMM yyyy", {
                      locale: en ? enUS : ru,
                    }),
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        update((q) => ({
                          ...q,
                          notes: {
                            ...q.notes,
                            [date]: {
                              text: String(f.get("text")),
                              mood: String(f.get("mood")),
                            },
                          },
                        }));
                        setModal(null);
                      }}
                    >
                      <label>
                        {tr("Заметка дня", "Daily note")}
                        <textarea
                          name="text"
                          defaultValue={p.notes[date]?.text}
                        />
                      </label>
                      <label>
                        {tr("Настроение", "Mood")}
                        <select
                          name="mood"
                          defaultValue={p.notes[date]?.mood || ""}
                        >
                          {["", "😊", "😐", "😔", "💪", "🌊"].map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                      <button className="primary">
                        {tr("Сохранить", "Save")}
                      </button>
                    </form>,
                  )
                }
              >
                <span>{i + 1}</span>
                {date === (c.actual || c.end) ? (
                  <Ship size={13} />
                ) : p.notes[date]?.mood ? (
                  <small>{p.notes[date].mood}</small>
                ) : done ? (
                  <Check size={12} />
                ) : p.notes[date]?.text ? (
                  <small>•</small>
                ) : null}
              </button>
            );
          },
        )}
      </div>
      <div className="legend">
        <span>
          <i className="green-dot" />
          {tr("Пройдено", "Completed")}
        </span>
        <span>
          <i className="blue-dot" />
          {tr("Сегодня", "Today")}
        </span>
        <span>
          <i />
          {tr("Впереди", "Upcoming")}
        </span>
      </div>
    </section>
  );
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" onClick={() => setPage(0)}>
          <span className="brand-icon">
            <Anchor size={24} />
          </span>
          <span>
            SEAFARER<small>CONTRACT & FINANCE</small>
          </span>
        </a>
        <div className="workspace-label">
          {tr("ЛИЧНЫЙ КАБИНЕТ", "YOUR WORKSPACE")}
        </div>
        <nav>
          {navigation.map(([r, e, Icon], i) => (
            <button
              key={i}
              className={page === i ? "active" : ""}
              onClick={() => setPage(i)}
            >
              <Icon size={19} />
              {tr(r, e)}
              {i === 0 && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sea-note">
            <Compass size={24} />
            <strong>
              {tr("Ваш курс — домой", "Set your course for home")}
            </strong>
            <p>
              {tr(
                "Каждый день в море приближает ваши цели.",
                "Every day at sea brings your goals closer.",
              )}
            </p>
          </div>
          <button className="profile-button" onClick={() => setPage(6)}>
            <div className="avatar">{p.name.slice(0, 2).toUpperCase()}</div>
            <span>
              {p.name}
              <small>{c.rank}</small>
            </span>
            <Settings size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header>
          <div className="breadcrumb">
            {tr("Мой кабинет", "My workspace")} <span>/</span>{" "}
            <strong>{tr(navigation[page][0], navigation[page][1])}</strong>
          </div>
          <div className="header-actions">
            <span className="local-badge">
              <i />
              {loadError
                ? tr("Ошибка сохранения", "Storage error")
                : tr("Сохранено на устройстве", "Stored on this device")}
            </span>
            <button
              className="icon"
              title="Language"
              onClick={() => setEn(!en)}
            >
              <Globe size={17} />
              <small>{en ? "EN" : "RU"}</small>
            </button>
            <button
              className="icon"
              title={tr("Тема", "Theme")}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <div className="avatar small">
              {p.name.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>
        <main>
          {loadError && <div className="warning">{loadError}</div>}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {format(parseISO(revision), "d MMMM yyyy", {
                  locale: en ? enUS : ru,
                })}{" "}
                · UTC
              </div>
              <h1>
                {page === 0
                  ? tr("С возвращением на борт", "Welcome aboard")
                  : tr(navigation[page][0], navigation[page][1])}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {page === 0
                  ? tr(
                      "Ваш контракт, финансы и цели — под надёжным контролем.",
                      "Your contract, finances and goals, all on course.",
                    )
                  : tr(
                      "Больше ясности. Больше уверенности в завтрашнем дне.",
                      "More clarity. More confidence in tomorrow.",
                    )}
              </p>
            </div>
            <button className="primary" onClick={() => transactionForm()}>
              <Plus size={17} />
              {tr("Добавить операцию", "Add transaction")}
            </button>
          </div>
          {page === 0 && (
            <>
              <section className="contract-banner">
                <div className="banner-orbit" />
                <div className="banner-top">
                  <span className="status-pill">
                    <i />
                    {revision < c.start
                      ? tr("КОНТРАКТ ВПЕРЕДИ", "UPCOMING CONTRACT")
                      : s.left
                        ? tr("В РЕЙСЕ", "ON BOARD")
                        : tr("КОНТРАКТ ЗАВЕРШЁН", "CONTRACT COMPLETE")}
                  </span>
                  <button onClick={contractForm}>
                    {tr("Редактировать контракт", "Edit contract")}
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="banner-body">
                  <div>
                    <h2>{c.rank}</h2>
                    <p>
                      <Ship size={16} />
                      {c.vessel || tr("Судно не указано", "Vessel not set")}
                      <span>•</span>
                      {c.company ||
                        tr("Компания не указана", "Company not set")}
                    </p>
                    <div className="contract-dates">
                      <span>
                        {tr("Посадка", "Joined")}
                        <strong>
                          {format(parseISO(c.start), "dd MMM yyyy", {
                            locale: en ? enUS : ru,
                          })}
                        </strong>
                      </span>
                      <ArrowRight size={18} />
                      <span>
                        {tr("Домой", "Sign-off")}
                        <strong>
                          {format(parseISO(c.actual || c.end), "dd MMM yyyy", {
                            locale: en ? enUS : ru,
                          })}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="countdown">
                    <strong>{s.left}</strong>
                    <span>{tr("дней до возвращения", "days until home")}</span>
                    <small>
                      {s.done} {tr("из", "of")} {s.total}{" "}
                      {tr("дней пройдено", "days completed")}
                    </small>
                  </div>
                </div>
                <div className="progress-label">
                  <span>{tr("Прогресс контракта", "Contract progress")}</span>
                  <strong>{s.percent.toFixed(1)}%</strong>
                </div>
                <div className="progress">
                  <span style={{ width: s.percent + "%" }} />
                </div>
              </section>
              <div className="stats-grid">
                {card(
                  tr("Месячная зарплата", "Monthly salary"),
                  money(c.salary),
                  <Wallet size={18} />,
                  c.method === "calendar"
                    ? tr("По календарным дням", "Calendar-month basis")
                    : tr("База 30 дней", "30-day basis"),
                )}
                {card(
                  tr("Заработано в рейсе", "Earned on contract"),
                  money(s.earned),
                  <TrendingUp size={18} />,
                  tr(
                    "Начислено, не обязательно получено",
                    "Accrued, not necessarily received",
                  ),
                )}
                {card(
                  tr("Доступно на счетах", "Available balance"),
                  money(t.balance),
                  <Wallet size={18} />,
                  tr(
                    "Общий остаток, включая семью",
                    "Combined balance, including family",
                  ),
                )}
                {card(
                  tr("Прогноз к списанию", "Projected at sign-off"),
                  money(forecast(p, c.actual || c.end)),
                  <Target size={18} />,
                  tr(
                    "При выбранных предположениях",
                    "Based on your assumptions",
                  ),
                  true,
                )}
              </div>
              <div className="finance-strip">
                {[
                  [tr("Зарплата получена", "Salary received"), t.received],
                  [
                    tr("Заработано, не выплачено", "Earned but unpaid"),
                    Math.max(0, s.earned - t.received),
                  ],
                  [
                    tr("Ещё заработать", "Future earnings"),
                    s.projected - s.earned,
                  ],
                  [tr("Всего за контракт", "Contract total"), s.projected],
                  [tr("Расходы", "Expenses"), t.expenses],
                  [tr("Переводы семье", "Family transfers"), t.family],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <small>{label}</small>
                    <strong>{money(Number(value))}</strong>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel chart-panel">
                  <div className="section-title">
                    <div>
                      <h3>{tr("Финансовый горизонт", "Financial horizon")}</h3>
                      <p>
                        {tr(
                          "Ваш путь к финансовым целям",
                          "Your journey toward financial goals",
                        )}
                      </p>
                    </div>
                    <span className="chip">USD</span>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="green-dot" />
                      {tr("Начисления", "Earnings")}
                    </span>
                    <span>
                      <i className="blue-dot" />
                      {tr("Прогноз баланса", "Balance forecast")}
                    </span>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chart}>
                        <defs>
                          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor="#24a896"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="100%"
                              stopColor="#24a896"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 6"
                          vertical={false}
                          stroke="var(--line)"
                        />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#8793a3" }}
                        />
                        <YAxis
                          tickFormatter={(v) => "$" + v / 1000 + "k"}
                          tickLine={false}
                          axisLine={false}
                          width={48}
                          tick={{ fontSize: 11, fill: "#8793a3" }}
                        />
                        <Tooltip formatter={(v) => money(Number(v))} />
                        <Area
                          name={tr("Начисления", "Earned")}
                          type="monotone"
                          dataKey="earned"
                          stroke="#21a38d"
                          strokeWidth={2.5}
                          fill="url(#fill)"
                        />
                        <Area
                          name={tr("Прогноз", "Forecast")}
                          type="monotone"
                          dataKey="forecast"
                          stroke="#6894d1"
                          strokeDasharray="5 5"
                          fill="transparent"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                {calendar}
              </div>
              <div className="dashboard-grid bottom-grid">
                <section className="panel">
                  <div className="section-title">
                    <h3>{tr("Последние операции", "Recent transactions")}</h3>
                    <button className="text-button" onClick={() => setPage(2)}>
                      {tr("Все операции", "View all")}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  {txList(4)}
                </section>
                <section className="panel">
                  <div className="section-title">
                    <h3>
                      {tr("Курс на мечту", "A course toward your dreams")}
                    </h3>
                    <Target size={18} />
                  </div>
                  {p.goals.length ? (
                    p.goals.slice(0, 2).map((g) => (
                      <div className="mini-goal" key={g.id}>
                        <strong>{g.name}</strong>
                        <span>
                          {money(g.saved)} <small>/ {money(g.target)}</small>
                        </span>
                        <div className="progress">
                          <span
                            style={{
                              width:
                                Math.min(100, (g.saved / g.target) * 100) + "%",
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="goal-invite">
                      <div className="goal-symbol">
                        <Target size={27} />
                      </div>
                      <h3>
                        {tr(
                          "У каждой мечты есть маршрут",
                          "Every dream has a destination",
                        )}
                      </h3>
                      <p>
                        {tr(
                          "Автомобиль, дом или отпуск с семьёй — начните с первой цели.",
                          "A car, a home or a family vacation — start with your first goal.",
                        )}
                      </p>
                    </div>
                  )}
                  <button className="secondary full" onClick={() => goalForm()}>
                    <Plus size={16} />
                    {tr("Добавить цель", "Add a goal")}
                  </button>
                </section>
              </div>
            </>
          )}
          {page === 1 && (
            <>
              <div className="info-bar">
                {tr(
                  "Нажмите на день, чтобы добавить заметку и настроение. Даты и начисления используют UTC.",
                  "Select a day to add a note and mood. Dates and earnings use UTC.",
                )}
              </div>
              {calendar}
              <section className="panel">
                <h3>{tr("Дневник рейса", "Voyage journal")}</h3>
                {Object.entries(p.notes)
                  .sort()
                  .filter(([, n]) => n.text || n.mood)
                  .map(([d, n]) => (
                    <p key={d}>
                      <strong>
                        {d} {n.mood}
                      </strong>{" "}
                      — {n.text}
                    </p>
                  ))}
              </section>
            </>
          )}
          {page === 2 && (
            <>
              <div className="stats-grid">
                {card(
                  tr("Получено зарплаты", "Salary received"),
                  money(t.received),
                  <ArrowDownLeft />,
                  tr("Фактические поступления", "Actual receipts"),
                )}
                {card(
                  tr("Начислено, не выплачено", "Earned but unpaid"),
                  money(Math.max(0, s.earned - t.received)),
                  <Wallet />,
                  tr(
                    "Не входит в доступный баланс",
                    "Excluded from available balance",
                  ),
                )}
                {card(
                  tr("Всего расходов", "Total expenses"),
                  money(t.expenses),
                  <ArrowUpRight />,
                  tr(
                    "Без внутренних переводов",
                    "Excluding internal transfers",
                  ),
                )}
                {card(
                  tr("Переведено семье", "Family transfers"),
                  money(t.family),
                  <ArrowLeftRight />,
                  tr(
                    "Переводы и внешние расходы семье",
                    "Transfers and external family expenses",
                  ),
                )}
              </div>
              <section className="panel">
                <div className="section-title">
                  <h3>{tr("История операций", "Transaction history")}</h3>
                  <input
                    className="search"
                    placeholder={tr(
                      "Поиск по дате, категории…",
                      "Search date, category…",
                    )}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
                {txList()}
              </section>
            </>
          )}
          {page === 3 && (
            <>
              <div className="info-bar">
                {tr("Личный остаток: ", "Personal balance: ")}
                <strong>{money(t.personal)}</strong> ·{" "}
                {tr("Общий с семейными счетами: ", "Combined with family: ")}
                <strong>{money(t.balance)}</strong>
              </div>
              <div className="account-grid">
                {p.accounts.map((a) => (
                  <section className="panel account-card" key={a.id}>
                    <div className="section-title">
                      <Wallet />
                      <button className="icon" onClick={() => accountForm(a)}>
                        <Pencil size={16} />
                      </button>
                    </div>
                    <p>
                      {a.name}
                      {a.family ? " · " + tr("Семейный", "Family") : ""}
                    </p>
                    <h2>{money(b[a.id])}</h2>
                    <small>
                      {tr("Начальный остаток", "Opening balance")}:{" "}
                      {money(a.opening)}
                    </small>
                    <div className="account-actions">
                      <button
                        className="text-button"
                        onClick={() =>
                          dialog(
                            tr("Сверка счёта", "Reconcile account"),
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const value = Number(
                                  new FormData(e.currentTarget).get("balance"),
                                );
                                update((q) => ({
                                  ...q,
                                  transactions: [
                                    ...q.transactions,
                                    {
                                      id: uid(),
                                      date: revision,
                                      type: "adjustment",
                                      amount: value - b[a.id],
                                      account: a.id,
                                      to: "",
                                      category: "Сверка",
                                      description: tr(
                                        "Корректировка остатка",
                                        "Balance reconciliation",
                                      ),
                                    },
                                  ],
                                }));
                                setModal(null);
                              }}
                            >
                              <label>
                                {tr(
                                  "Фактический остаток, USD",
                                  "Actual balance, USD",
                                )}
                                <input
                                  name="balance"
                                  type="number"
                                  step="0.01"
                                  required
                                  defaultValue={b[a.id]}
                                />
                              </label>
                              <button className="primary">
                                {tr("Сверить", "Reconcile")}
                              </button>
                            </form>,
                          )
                        }
                      >
                        {tr("Сверить остаток", "Reconcile")}
                      </button>
                      <button
                        className="icon"
                        onClick={() => {
                          if (
                            p.accounts.length === 1 ||
                            p.transactions.some(
                              (x) => x.account === a.id || x.to === a.id,
                            )
                          )
                            return alert(
                              tr(
                                "Счёт используется или является последним",
                                "Account is in use or is the last account",
                              ),
                            );
                          if (confirm(tr("Удалить счёт?", "Delete account?")))
                            update((q) => ({
                              ...q,
                              accounts: q.accounts.filter((x) => x.id !== a.id),
                            }));
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </section>
                ))}
              </div>
              <button className="secondary" onClick={() => accountForm()}>
                <Plus size={16} />
                {tr("Добавить счёт", "Add account")}
              </button>
            </>
          )}
          {page === 4 && (
            <>
              <div className="account-grid">
                {p.goals.map((g) => (
                  <section className="panel" key={g.id}>
                    <div className="section-title">
                      <Target />
                      <button className="icon" onClick={() => goalForm(g)}>
                        <Pencil size={16} />
                      </button>
                    </div>
                    <h2>{g.name}</h2>
                    <p>
                      {money(g.saved)} / {money(g.target)}
                    </p>
                    <div className="progress">
                      <span
                        style={{
                          width:
                            Math.min(100, (g.saved / g.target) * 100) + "%",
                        }}
                      />
                    </div>
                    <p>
                      {((g.saved / g.target) * 100).toFixed(1)}% ·{" "}
                      {g.saved >= g.target
                        ? tr("Цель достигнута", "Goal achieved")
                        : p.monthlySaving > 0
                          ? format(
                              addMonths(
                                parseISO(revision),
                                Math.ceil(
                                  (g.target - g.saved) / p.monthlySaving,
                                ),
                              ),
                              "MMM yyyy",
                              { locale: en ? enUS : ru },
                            )
                          : tr(
                              "Задайте план накоплений ниже",
                              "Set a savings plan below",
                            )}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (confirm(tr("Удалить цель?", "Delete goal?")))
                          update((q) => ({
                            ...q,
                            goals: q.goals.filter((x) => x.id !== g.id),
                          }));
                      }}
                    >
                      {tr("Удалить", "Delete")}
                    </button>
                  </section>
                ))}
              </div>
              <button className="secondary" onClick={() => goalForm()}>
                <Plus size={16} />
                {tr("Новая цель", "New goal")}
              </button>
              <section className="panel forecast">
                <h2>{tr("Финансовый прогноз", "Financial forecast")}</h2>
                <p className="muted">
                  {tr(
                    "Сценарий предполагает выплату всей начисленной зарплаты к выбранной дате. Фактический баланс смотрите в счетах. Будущие операции не прибавляются к прогнозу: используйте предположения ниже.",
                    "Scenario assumes accrued salary is paid by the selected date. Check accounts for actual balances. Future transactions are excluded from forecasts; use assumptions below.",
                  )}
                </p>
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    update((q) => ({
                      ...q,
                      dailySpend: Number(f.get("daily")),
                      monthlyIncome: Number(f.get("income")),
                      monthlySaving: Number(f.get("saving")),
                    }));
                  }}
                  key={p.id}
                >
                  {field(
                    tr("Расходы в день, USD", "Daily spending, USD"),
                    "daily",
                    p.dailySpend,
                    "number",
                  )}
                  {field(
                    tr(
                      "Другой доход в месяц, USD",
                      "Other monthly income, USD",
                    ),
                    "income",
                    p.monthlyIncome,
                    "number",
                  )}
                  {field(
                    tr(
                      "План накоплений в месяц, USD",
                      "Monthly savings allocation, USD",
                    ),
                    "saving",
                    p.monthlySaving,
                    "number",
                  )}
                  <button className="primary">
                    {tr("Обновить прогноз", "Update forecast")}
                  </button>
                </form>
                <div className="forecast-values">
                  {[
                    revision,
                    iso(endOfMonth(parseISO(revision))),
                    c.actual || c.end,
                  ].map((d, i) => (
                    <div key={i}>
                      <small>
                        {
                          [
                            tr("Сегодня", "Today"),
                            tr("Конец месяца", "Month end"),
                            tr("Конец контракта", "Contract end"),
                          ][i]
                        }
                      </small>
                      <strong>{money(forecast(p, d))}</strong>
                    </div>
                  ))}
                </div>
                <label>
                  {tr("Произвольная будущая дата", "Custom future date")}
                  <input
                    type="date"
                    min={revision}
                    value={forecastDate}
                    onChange={(e) => setForecastDate(e.target.value)}
                  />
                </label>
                <h2>
                  {forecastDate >= revision
                    ? money(forecast(p, forecastDate))
                    : tr("Выберите будущую дату", "Choose a future date")}
                </h2>
                <p className="muted">
                  {tr(
                    "План накоплений — распределение средств, а не дополнительный доход или расход. Оценки целей рассчитываются независимо.",
                    "Savings allocation is not extra income or spending. Goal dates are estimated independently.",
                  )}
                </p>
              </section>
            </>
          )}
          {page === 5 && (
            <>
              <section className="panel">
                <div className="section-title">
                  <h3>{tr("Текущий контракт", "Current contract")}</h3>
                  <button className="secondary" onClick={contractForm}>
                    <Pencil size={15} />
                    {tr("Изменить", "Edit")}
                  </button>
                </div>
                <h2>{c.name}</h2>
                <p>
                  {c.vessel || "—"} · {c.company || "—"} · {c.start} →{" "}
                  {c.actual || c.end}
                </p>
                <div className="forecast-values">
                  <div>
                    <small>{tr("Начислено", "Earned")}</small>
                    <strong>{money(s.earned)}</strong>
                  </div>
                  <div>
                    <small>{tr("Ожидается всего", "Projected total")}</small>
                    <strong>{money(s.projected)}</strong>
                  </div>
                  <div>
                    <small>
                      {tr("Ещё предстоит заработать", "Future earnings")}
                    </small>
                    <strong>{money(s.projected - s.earned)}</strong>
                  </div>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    if (
                      confirm(
                        tr(
                          "Архивировать контракт и начать новый? Счета и операции останутся в профиле.",
                          "Archive contract and start a new one? Accounts and transactions remain in this profile.",
                        ),
                      )
                    )
                      update((q) => ({
                        ...q,
                        history: [...q.history, q.contract],
                        contract: {
                          ...newContract(),
                          start: revision,
                          end: expectedEnd(revision, 3),
                        },
                      }));
                  }}
                >
                  {tr("В архив и новый контракт", "Archive & new contract")}
                </button>
              </section>
              <section className="panel table-wrap">
                <h3>{tr("История и сравнение", "History and comparison")}</h3>
                <table>
                  <thead>
                    <tr>
                      {[
                        tr("Контракт / судно", "Contract / vessel"),
                        tr("Компания", "Company"),
                        tr("Период", "Period"),
                        tr("Дней", "Days"),
                        tr("Итого начислено", "Total earned"),
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.history.map((h) => (
                      <tr key={h.id}>
                        <td>
                          {h.name}
                          <small>{h.vessel}</small>
                        </td>
                        <td>{h.company || "—"}</td>
                        <td>
                          {h.start} → {h.actual || h.end}
                        </td>
                        <td>{stats(h).total}</td>
                        <td>{money(earnings(h, endExclusive(h)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!p.history.length && (
                  <p className="muted">
                    {tr(
                      "Завершённые контракты появятся здесь.",
                      "Archived contracts will appear here.",
                    )}
                  </p>
                )}
              </section>
            </>
          )}
          {page === 6 && (
            <>
              <section className="panel">
                <h2>{tr("Профили моряков", "Seafarer profiles")}</h2>
                <p className="muted">
                  {tr(
                    "У каждого профиля свои контракты, счета, операции и цели.",
                    "Each profile has separate contracts, accounts, transactions and goals.",
                  )}
                </p>
                <div className="profiles">
                  {data.profiles.map((q) => (
                    <div
                      className={
                        "profile-row " + (q.id === p.id ? "selected" : "")
                      }
                      key={q.id}
                    >
                      <button
                        onClick={() => setData((d) => ({ ...d, active: q.id }))}
                      >
                        <div className="avatar">{q.name.slice(0, 2)}</div>
                        <strong>{q.name}</strong>
                        {q.id === p.id && <Check size={17} />}
                      </button>
                      <button
                        className="icon"
                        onClick={() => {
                          const name = prompt(
                            tr("Имя профиля", "Profile name"),
                            q.name,
                          );
                          if (name?.trim())
                            setData((d) => ({
                              ...d,
                              profiles: d.profiles.map((x) =>
                                x.id === q.id ? { ...x, name: name.trim() } : x,
                              ),
                            }));
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon"
                        onClick={() => {
                          if (data.profiles.length === 1) return;
                          if (
                            confirm(
                              tr(
                                "Удалить профиль и все его данные?",
                                "Delete profile and all its records?",
                              ),
                            )
                          )
                            setData((d) => {
                              const profiles = d.profiles.filter(
                                (x) => x.id !== q.id,
                              );
                              return {
                                ...d,
                                profiles,
                                active:
                                  d.active === q.id ? profiles[0].id : d.active,
                              };
                            });
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    const name = prompt(
                      tr("Имя нового профиля", "New profile name"),
                    );
                    if (name?.trim()) {
                      const q = newProfile(name.trim());
                      setData((d) => ({
                        ...d,
                        active: q.id,
                        profiles: [...d.profiles, q],
                      }));
                    }
                  }}
                >
                  <Plus size={16} />
                  {tr("Добавить профиль", "Add profile")}
                </button>
              </section>
              <section className="panel">
                <h2>
                  {tr("Хранение и резервные копии", "Storage and backups")}
                </h2>
                <div className="warning">
                  {tr(
                    "Данные хранятся только в этом браузере. Они не синхронизируются между устройствами и могут исчезнуть при очистке браузера. Регулярно сохраняйте JSON-копию. Файлы содержат ваши финансовые данные — храните их безопасно.",
                    "Data lives only in this browser. It does not sync across devices and may be lost when browser data is cleared. Back up regularly. Exports contain your financial records; store them securely.",
                  )}
                </div>
                <div className="button-row">
                  <button className="secondary" onClick={backup}>
                    <Download size={16} />
                    {tr("Резервная копия JSON", "JSON backup")}
                  </button>
                  <button className="secondary" onClick={excel}>
                    <Download size={16} />
                    {tr("Отчёт Excel", "Excel report")}
                  </button>
                  <label className="secondary upload">
                    <Upload size={16} />
                    {tr("Восстановить JSON / Excel", "Restore JSON / Excel")}
                    <input
                      type="file"
                      accept=".json,.xlsx"
                      onChange={(e) => {
                        void restore(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="muted">
                  {tr(
                    "Excel содержит текущий профиль в отчётах и полную копию всех профилей на листе Backup. Не редактируйте Backup для восстановления.",
                    "Excel reports cover the current profile; Backup contains all profiles. Keep the Backup sheet intact for restoration.",
                  )}
                </p>
              </section>
              <section className="panel">
                <h2>{tr("Демонстрационные данные", "Sample data")}</h2>
                <p>
                  {tr(
                    "Создайте отдельный тестовый профиль с вымышленными данными. Ваши записи сохранятся.",
                    "Create a separate fictional sample profile. Your records are preserved.",
                  )}
                </p>
                <button
                  className="secondary"
                  onClick={() => {
                    const q = newProfile(tr("ДЕМО · Алексей", "SAMPLE · Alex"));
                    q.contract = {
                      ...q.contract,
                      vessel: "Northern Horizon",
                      company: "Oceanic Shipping · DEMO",
                    };
                    q.accounts[0].opening = 2500;
                    q.accounts[1].opening = 600;
                    q.transactions = [
                      {
                        id: uid(),
                        date: revision,
                        type: "salary",
                        amount: 1500,
                        account: q.accounts[0].id,
                        to: "",
                        category: "Зарплата",
                        description: "ДЕМО · Аванс",
                      },
                      {
                        id: uid(),
                        date: revision,
                        type: "transfer",
                        amount: 500,
                        account: q.accounts[0].id,
                        to: q.accounts[1].id,
                        category: categories[0],
                        description: "ДЕМО · Семейный бюджет",
                      },
                      {
                        id: uid(),
                        date: revision,
                        type: "expense",
                        amount: 85,
                        account: q.accounts[1].id,
                        to: "",
                        category: categories[1],
                        description: "ДЕМО · Продукты",
                      },
                    ];
                    q.goals = [
                      {
                        id: uid(),
                        name: "ДЕМО · Семейный автомобиль",
                        target: 25000,
                        saved: 6500,
                      },
                    ];
                    q.dailySpend = 25;
                    q.monthlySaving = 2000;
                    setData((d) => ({
                      ...d,
                      active: q.id,
                      profiles: [...d.profiles, q],
                    }));
                  }}
                >
                  {tr("Создать демо-профиль", "Create sample profile")}
                </button>
              </section>
            </>
          )}
          <footer>
            <span>
              <Anchor size={13} /> SEAFARER <span>·</span>{" "}
              {tr(
                "Спокойствие в море. Уверенность на берегу.",
                "Peace at sea. Confidence ashore.",
              )}
            </span>
            <span>
              {tr("Локально · Без подписок", "Local · No subscriptions")}
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div onClick={(e) => e.stopPropagation()}>{modal}</div>
        </div>
      )}
    </div>
  );
}
