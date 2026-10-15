import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  approvePayment,
  getCash,
  getEvents,
  getTickets,
  runTicket,
} from "./api";
import type { AgentReport, AuditEvent, CashAccount, Ticket } from "./api";
import { readDesk } from "./interpret";
import type { AgentId, AgentPicture, Handoff, PreparedPayment } from "./interpret";

const NAMES: Record<AgentId, string> = {
  boss: "Boss",
  inventory: "Inventory",
  accounting: "Accounting",
  facilities: "Facilities",
  customer_service: "Customer service",
};

const TITLES: Record<AgentId, string> = {
  boss: "Floor lead",
  inventory: "Stock room",
  accounting: "Cash drawer",
  facilities: "Lease book",
  customer_service: "Front counter",
};

const NOT_A_PERSON = new Set([
  "agent",
  "accounting",
  "boss",
  "customer service",
  "customer_service",
  "customerservice",
  "facilities",
  "inventory",
  "system",
  "the agent",
  "the boss",
]);

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function typeLabel(type: string): string {
  if (type === "customer_order") return "Customer order";
  if (type === "rent_notice") return "Rent notice";
  if (type === "price_override") return "Price request";
  return type;
}

function orderLine(ticket: Ticket): string {
  const bits = [ticket.sku, ticket.size ? `size ${ticket.size}` : null, ticket.qty ? `qty ${ticket.qty}` : null]
    .filter(Boolean)
    .join(" · ");
  return bits;
}

function useAnimatedMoney(value: number | null): number | null {
  const [shown, setShown] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    if (value == null) {
      previous.current = value;
      setShown(value);
      return;
    }
    const start = previous.current ?? value;
    previous.current = value;
    if (start === value) {
      setShown(value);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / 900);
      const eased = 1 - (1 - progress) ** 3;
      setShown(start + (value - start) * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return shown;
}

function Seal({ id }: { id: AgentId }) {
  if (id === "boss") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 19.5 16 8.5 22 19.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 16.5h8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (id === "inventory") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 12.5 16 8l9 4.5v9L16 26l-9-4.5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 12.5 16 17l9-4.5M16 17v9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (id === "accounting") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="7" y="9" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 14h18M12 18h4" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (id === "facilities") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M8 24V12l8-5 8 5v12" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M13 24v-6h6v6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 22.5c2.2-4 4.2-6 7-6s4.8 2 7 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function HandoffMap({ handoffs }: { handoffs: Handoff[] }) {
  const layer = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ key: string; active: boolean; x1: number; y1: number; x2: number; y2: number }[]>([]);

  useLayoutEffect(() => {
    const root = layer.current?.parentElement;
    if (!root) return;
    const measure = () => {
      const origin = root.getBoundingClientRect();
      const next = handoffs.flatMap((hand) => {
        const fromEl = root.querySelector<HTMLElement>(`[data-agent="${hand.from}"]`);
        const toEl = root.querySelector<HTMLElement>(`[data-agent="${hand.to}"]`);
        if (!fromEl || !toEl) return [];
        const from = fromEl.getBoundingClientRect();
        const to = toEl.getBoundingClientRect();
        const fromBox = {
          left: from.left - origin.left,
          top: from.top - origin.top,
          width: from.width,
          height: from.height,
        };
        const toBox = {
          left: to.left - origin.left,
          top: to.top - origin.top,
          width: to.width,
          height: to.height,
        };
        const start = edge(fromBox, toBox.left + toBox.width / 2, toBox.top + toBox.height / 2);
        const end = edge(toBox, fromBox.left + fromBox.width / 2, fromBox.top + fromBox.height / 2);
        return [{ key: `${hand.from}-${hand.to}`, active: hand.active, x1: start.x, y1: start.y, x2: end.x, y2: end.y }];
      });
      setLines(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [handoffs]);

  return (
    <div ref={layer} className="handoff-layer">
      <svg>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6" fill="none" stroke="#e36b1a" strokeWidth="1.2" />
          </marker>
        </defs>
        {lines.map((line) => (
          <line
            key={line.key}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className={line.active ? "handoff live" : "handoff settled"}
            markerEnd="url(#arrowhead)"
          />
        ))}
      </svg>
    </div>
  );
}

function edge(box: { left: number; top: number; width: number; height: number }, towardX: number, towardY: number) {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : box.width / 2 / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : box.height / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function AgentCard({ agent }: { agent: AgentPicture }) {
  const phaseLabel =
    agent.phase === "working" ? "Working" : agent.phase === "done" ? "Done" : agent.phase === "not_called" ? "Not called" : "Idle";
  return (
    <article className={`person agent-${agent.id}`} data-agent={agent.id} data-phase={agent.phase}>
      <header>
        <span className="seal">
          <Seal id={agent.id} />
        </span>
        <div>
          <h3>{NAMES[agent.id]}</h3>
          <p>{TITLES[agent.id]}</p>
        </div>
        <span className="phase">{phaseLabel}</span>
      </header>
      <p className="bubble">{agent.line}</p>
      {agent.tools.length > 0 && (
        <ul className="chips">
          {agent.tools.map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cash, setCash] = useState<CashAccount | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [boot, setBoot] = useState<"loading" | "ready" | "error">("loading");
  const [bootError, setBootError] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [since, setSince] = useState("");
  const [report, setReport] = useState<AgentReport | null>(null);
  const [wrapped, setWrapped] = useState(false);
  const [runFor, setRunFor] = useState<number | null>(null);
  const [celebrateId, setCelebrateId] = useState<number | null>(null);
  const [dropped, setDropped] = useState(false);
  const [approver, setApprover] = useState(() => sessionStorage.getItem("campus-customs-name") ?? "");
  const [approvalError, setApprovalError] = useState("");
  const [approving, setApproving] = useState(false);
  const [declinedKey, setDeclinedKey] = useState("");

  const shownBalance = useAnimatedMoney(cash?.balance ?? null);
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const showingRun = selected != null && runFor === selected.id;
  const runEvents = showingRun && since ? events.filter((event) => event.recorded_at >= since) : [];
  const desk = readDesk(runEvents, showingRun && wrapped, selected, showingRun ? report : null);
  const paymentKey = desk.payment ? `${selectedId}:${desk.payment.kind}:${desk.payment.refId}:${desk.payment.amount}` : "";
  const payment = paymentKey && paymentKey === declinedKey ? null : desk.payment;

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const [nextTickets, nextCash] = await Promise.all([getTickets(), getCash()]);
        if (cancel) return;
        setTickets(nextTickets);
        setCash(nextCash);
        setSelectedId((current) => current ?? nextTickets[0]?.id ?? null);
        setBoot("ready");
      } catch (error) {
        if (cancel) return;
        setBoot("error");
        setBootError(error instanceof Error ? error.message : "The shop could not open.");
      }
    };
    void load();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!running || !since) return;
    let cancel = false;
    const poll = async () => {
      while (!cancel) {
        try {
          const next = await getEvents(200);
          if (!cancel) setEvents(next);
        } catch {
          // The run request is still the source of a real failure.
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };
    void poll();
    return () => {
      cancel = true;
    };
  }, [running, since]);

  async function startRun() {
    if (!selected || running) return;
    const started = new Date(Date.now() - 2000).toISOString();
    setRunFor(selected.id);
    setSince(started);
    setEvents([]);
    setReport(null);
    setWrapped(false);
    setCelebrateId(null);
    setRunError("");
    setApprovalError("");
    setDeclinedKey("");
    setRunning(true);
    try {
      const nextReport = await runTicket(selected.id);
      const [nextEvents, nextTickets] = await Promise.all([getEvents(200), getTickets()]);
      setEvents(nextEvents);
      setTickets(nextTickets);
      setReport(nextReport);
      setWrapped(true);
      const updated = nextTickets.find((ticket) => ticket.id === selected.id);
      if (updated?.status === "resolved") setCelebrateId(selected.id);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "The run stopped before anyone finished.");
    } finally {
      setRunning(false);
    }
  }

  async function approve(next: PreparedPayment) {
    const name = approver.trim();
    if (!name) {
      setApprovalError("Sign your name before the money moves.");
      return;
    }
    if (NOT_A_PERSON.has(name.toLowerCase())) {
      setApprovalError("That has to be a person, not one of the agents.");
      return;
    }
    setApproving(true);
    setApprovalError("");
    sessionStorage.setItem("campus-customs-name", name);
    try {
      await approvePayment({
        kind: next.kind,
        ref_id: next.refId,
        amount: next.amount,
        approved_by: name,
        account: next.account,
      });
      const nextCash = await getCash();
      setDropped(true);
      setCash(nextCash);
      window.setTimeout(() => setDropped(false), 1200);
      setDeclinedKey(`${selectedId}:${next.kind}:${next.refId}:${next.amount}`);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : "The drawer did not open.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="shop">
      <header className="mast">
        <div>
          <p className="eyebrow">Chapel Street shop</p>
          <h1>Campus Customs</h1>
          <p className="lede">The print-shop desk. Pick a ticket, watch the floor, and sign before any cash leaves.</p>
        </div>
        <div className="stamp" aria-hidden="true">
          Shop
          <br />
          today
          <strong>Aug 31</strong>
        </div>
      </header>

      {boot === "error" ? (
        <section className="notice">
          <h2>The lamps are on, but the back room is quiet.</h2>
          <p>{bootError}</p>
        </section>
      ) : (
        <div className="desk">
          <aside className="rail spike">
            <h2>Ticket spike</h2>
            {boot === "loading" && <p className="quiet">Opening the shop…</p>}
            {boot === "ready" && tickets.length === 0 && <p className="quiet">The spike is empty. Nothing is waiting.</p>}
            <ul>
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    className={ticket.id === selectedId ? "slip selected" : "slip"}
                    onClick={() => {
                      setSelectedId(ticket.id);
                      setWrapped(false);
                      setRunFor(null);
                      setReport(null);
                      setEvents([]);
                      setSince("");
                      setRunError("");
                      setCelebrateId(null);
                    }}
                  >
                    <span className="slip-id">{ticket.id}</span>
                    <span>
                      <strong>{ticket.subject}</strong>
                      <em>{ticket.requester}</em>
                    </span>
                    <span className={ticket.status === "resolved" ? "badge resolved" : "badge open"}>
                      {ticket.status === "resolved" ? "Resolved" : "Open"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <main className="stage">
            {!selected && boot === "ready" && <p className="quiet">Choose a ticket from the spike.</p>}
            {selected && (
              <>
                <section className={`blotter ${celebrateId === selected.id ? "celebrate" : ""}`}>
                  {celebrateId === selected.id && (
                    <div className="confetti" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  <div className="blotter-top">
                    <div>
                      <p className="eyebrow">{typeLabel(selected.type)}</p>
                      <h2>
                        {selected.id} · {selected.subject}
                      </h2>
                      <p className="who">{selected.requester}</p>
                    </div>
                    <span className={selected.status === "resolved" ? "badge resolved big" : "badge open big"}>
                      {selected.status === "resolved" ? "Resolved" : "Open"}
                    </span>
                  </div>
                  {orderLine(selected) && <p className="order">{orderLine(selected)}</p>}
                  {selected.notes && <p className="note">{selected.notes}</p>}
                  <div className="run-row">
                    <button type="button" className="start" onClick={() => void startRun()} disabled={running}>
                      {running ? "The floor is working…" : selected.status === "resolved" ? "Run again" : "Start the team"}
                    </button>
                    <p className="quiet">
                      {running
                        ? "Watch the desks. A hand-off shows up as an orange line."
                          : showingRun && wrapped
                          ? "The run is posted below."
                          : "One ticket at a time. Cash does not move until you approve it."}
                    </p>
                  </div>
                  {runError && <p className="trouble">{runError}</p>}
                </section>

                <section className="floor" aria-label="Agent desks">
                  <HandoffMap handoffs={desk.handoffs} />
                  {desk.agents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </section>

                {showingRun && wrapped && (
                  <section className="wrap">
                    <h3>What the desk did</h3>
                    <ul>
                      {desk.agents.map((agent) => (
                        <li key={agent.id} className={agent.phase === "not_called" ? "absent" : ""}>
                          <strong>{NAMES[agent.id]}</strong>
                          {agent.phase === "not_called" ? (
                            <span>not called</span>
                          ) : (
                            <span>
                              {agent.line}
                              {agent.tools.length > 0 ? ` Tools: ${agent.tools.join(", ")}.` : ""}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </main>

          <aside className="rail drawer-rail">
            <section className={`drawer ${dropped ? "dropping" : ""}`}>
              <p className="eyebrow">Checking</p>
              <p className="balance">{shownBalance == null ? "—" : money.format(shownBalance)}</p>
              <p className="asof">{cash ? `Book date ${cash.date}` : "Reading the drawer…"}</p>
            </section>

            {payment ? (
              <section className="approval">
                <p className="eyebrow">Needs your approval</p>
                <h3>{money.format(payment.amount)}</h3>
                <p className="payee">{payment.payee}</p>
                <p className="reason">{payment.reason}</p>
                <p className="meta">
                  {payment.kind === "rent" ? "Rent" : "Invoice"} {payment.refId} · {payment.account}
                </p>
                <label>
                  Your name
                  <input
                    value={approver}
                    onChange={(event) => setApprover(event.target.value)}
                    placeholder="Sign here"
                    autoComplete="name"
                  />
                </label>
                {approvalError && <p className="trouble">{approvalError}</p>}
                <div className="decision">
                  <button type="button" className="approve" disabled={approving} onClick={() => void approve(payment)}>
                    {approving ? "Signing…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="decline"
                    disabled={approving}
                    onClick={() => setDeclinedKey(paymentKey)}
                  >
                    Decline
                  </button>
                </div>
              </section>
            ) : desk.discountNote ? (
              <section className="waiting-note">
                <p className="eyebrow">Waiting on a person</p>
                <p>{desk.discountNote}</p>
              </section>
            ) : (
              <section className="waiting-note quiet-card">
                <p className="eyebrow">Approvals</p>
                <p>Nothing is waiting on your signature. The drawer stays shut until an agent prepares a payment.</p>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
