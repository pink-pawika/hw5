import type { AgentReport, AuditEvent, Ticket } from "./api";

export const AGENT_IDS = [
  "boss",
  "inventory",
  "accounting",
  "facilities",
  "customer_service",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export type AgentPhase = "idle" | "working" | "done" | "not_called";

export type AgentPicture = {
  id: AgentId;
  phase: AgentPhase;
  line: string;
  tools: string[];
};

export type Handoff = {
  from: AgentId;
  to: AgentId;
  active: boolean;
};

export type PreparedPayment = {
  kind: "invoice" | "rent";
  refId: number;
  amount: number;
  account: string;
  payee: string;
  reason: string;
};

export type DeskRead = {
  agents: AgentPicture[];
  handoffs: Handoff[];
  payment: PreparedPayment | null;
  discountNote: string | null;
};

const IDLE: Record<AgentId, string> = {
  boss: "Waiting on the next ticket.",
  inventory: "The shelves are quiet.",
  accounting: "The drawer is latched.",
  facilities: "The lease folder is closed.",
  customer_service: "The counter is clear.",
};

const TOOL_LINE: Record<string, string> = {
  read_desk: "Checking the shop date.",
  read_ticket: "Reading this ticket.",
  list_open_tickets: "Looking over the open spike.",
  check_stock: "Counting what is on the shelf.",
  list_sizes: "Checking the other sizes.",
  read_invoice: "Opening the vendor bill.",
  read_vendor: "Looking up who can restock.",
  list_vendors: "Scanning the vendor book.",
  read_cash: "Opening the cash drawer.",
  list_payments: "Seeing what has already left.",
  read_lease: "Reading the lease.",
  read_pricing: "Checking cost and the list price.",
  append_ticket_note: "Writing a note on the ticket.",
  set_ticket_status: "Updating the ticket stamp.",
  pay: "Sending money out.",
};

const NAMES: Record<AgentId, string> = {
  boss: "the boss",
  inventory: "inventory",
  accounting: "accounting",
  facilities: "facilities",
  customer_service: "customer service",
};

function isAgent(value: string): value is AgentId {
  return (AGENT_IDS as readonly string[]).includes(value);
}

function clip(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function toolName(detail: Record<string, unknown>): string | null {
  const name = detail.tool_name;
  return typeof name === "string" && name ? name : null;
}

function reportOf(value: unknown): AgentReport | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { summary?: unknown; waiting_on_human?: unknown; facts?: unknown };
  if (typeof row.summary !== "string") return null;
  const facts = Array.isArray(row.facts)
    ? row.facts.filter((item): item is string => typeof item === "string")
    : [];
  return {
    summary: row.summary,
    facts,
    waiting_on_human: row.waiting_on_human === true,
    draft_for_the_board:
      typeof (row as { draft_for_the_board?: unknown }).draft_for_the_board === "string"
        ? ((row as { draft_for_the_board: string }).draft_for_the_board)
        : null,
  };
}

type InvoiceFact = { id: number; amount: number; payee: string };
type LeaseFact = { id: number; amount: number; payee: string };

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function walkObjects(value: unknown, out: Record<string, unknown>[]): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        walkObjects(JSON.parse(trimmed), out);
      } catch {
        return;
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, out);
    return;
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    out.push(row);
    for (const nested of Object.values(row)) walkObjects(nested, out);
  }
}

function moneyNear(text: string, label: RegExp): number | null {
  const match = text.match(label);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ""));
}

export function readDesk(
  events: AuditEvent[],
  finished: boolean,
  ticket: Ticket | null,
  bossReport: AgentReport | null,
): DeskRead {
  const live: Record<AgentId, string> = { ...IDLE };
  const said: Partial<Record<AgentId, string>> = {};
  const tools: Record<AgentId, string[]> = {
    boss: [],
    inventory: [],
    accounting: [],
    facilities: [],
    customer_service: [],
  };
  const phase: Record<AgentId, AgentPhase> = {
    boss: "idle",
    inventory: "idle",
    accounting: "idle",
    facilities: "idle",
    customer_service: "idle",
  };
  const handoffs: Handoff[] = [];
  const objects: Record<string, unknown>[] = [];
  let waiting = bossReport?.waiting_on_human === true;
  let paidAlready = false;

  const touch = (id: AgentId) => {
    if (phase[id] !== "done") phase[id] = "working";
  };

  for (const event of events) {
    if (!isAgent(event.agent)) continue;
    const agent = event.agent;
    const detail = event.detail ?? {};

    if (event.kind === "run_start") {
      touch(agent);
      live[agent] = "Picking this up.";
    }

    if (event.kind === "tool_call") {
      const name = toolName(detail);
      touch(agent);
      if (name?.startsWith("ask_") && isAgent(name.slice(4))) {
        live[agent] = `Asking ${NAMES[name.slice(4) as AgentId]}.`;
      } else if (name) {
        if (!tools[agent].includes(name)) tools[agent].push(name);
        live[agent] = TOOL_LINE[name] ?? `Using ${name}.`;
      }
    }

    if (event.kind === "tool_result") {
      walkObjects(detail.content, objects);
      const name = toolName(detail);
      if (name === "pay") {
        const blob = JSON.stringify(detail.content ?? "");
        if (/"paid"\s*:\s*true/.test(blob)) paidAlready = true;
      }
    }

    if (event.kind === "delegate") {
      const target = detail.target;
      touch(agent);
      if (typeof target === "string" && isAgent(target)) {
        live[agent] = `Handing this to ${NAMES[target]}.`;
        const task = typeof detail.task === "string" ? clip(detail.task, 140) : "";
        if (task) live[target] = task;
        touch(target);
        const existing = handoffs.find((row) => row.from === agent && row.to === target);
        if (existing) existing.active = true;
        else handoffs.push({ from: agent, to: target, active: true });
      }
    }

    if (event.kind === "delegate_result" || event.kind === "delegate_refused") {
      const target = detail.target;
      if (typeof target === "string" && isAgent(target)) {
        const existing = handoffs.find((row) => row.from === agent && row.to === target);
        if (existing) existing.active = false;
        const report = reportOf(detail.report);
        if (report) {
          said[target] = report.summary;
          if (report.waiting_on_human) waiting = true;
          if (phase[target] === "working") phase[target] = "done";
        }
      }
    }

    if (event.kind === "run_end") {
      const report = reportOf(detail.report);
      phase[agent] = "done";
      if (report) {
        said[agent] = report.summary;
        if (report.waiting_on_human) waiting = true;
      }
    }
  }

  if (bossReport) {
    said.boss = said.boss ?? bossReport.summary;
    if (finished) phase.boss = "done";
  }

  if (finished) {
    for (const id of AGENT_IDS) {
      if (phase[id] === "working") phase[id] = "done";
      const spoke = said[id] || tools[id].length > 0 || phase[id] === "done";
      if (!spoke) phase[id] = "not_called";
    }
    if (said.boss || bossReport) phase.boss = "done";
  }

  const agents: AgentPicture[] = AGENT_IDS.map((id) => ({
    id,
    phase: phase[id],
    line: said[id] ? clip(said[id]) : live[id],
    tools: tools[id],
  }));

  const invoices: InvoiceFact[] = [];
  const leases: LeaseFact[] = [];
  for (const row of objects) {
    const amount = asNumber(row.amount);
    const id = asNumber(row.id);
    if (amount != null && id != null && typeof row.vendor_name === "string") {
      invoices.push({ id, amount, payee: row.vendor_name });
    }
    const rent = asNumber(row.monthly_rent);
    if (rent != null && id != null && typeof row.landlord === "string") {
      leases.push({ id, amount: rent, payee: row.landlord });
    }
  }

  const prose = [
    bossReport?.summary ?? "",
    ...(bossReport?.facts ?? []),
    ...AGENT_IDS.map((id) => said[id] ?? ""),
  ].join("\n");

  let payment: PreparedPayment | null = null;
  if (waiting && !paidAlready && ticket) {
    if (ticket.type === "rent_notice" || ticket.lease_id) {
      const lease =
        leases.find((row) => row.id === ticket.lease_id) ?? leases[leases.length - 1];
      const amount =
        lease?.amount ??
        moneyNear(prose, /(?:rent|monthly)[^\d$]{0,24}\$?([0-9]{3,5}(?:\.\d{2})?)/i);
      if (lease || (ticket.lease_id && amount != null)) {
        payment = {
          kind: "rent",
          refId: lease?.id ?? ticket.lease_id ?? 0,
          amount: amount ?? 0,
          account: "checking",
          payee: lease?.payee ?? ticket.requester,
          reason: clip(said.boss || bossReport?.summary || "Rent is ready for a person to approve.", 220),
        };
      }
    } else if (ticket.invoice_id) {
      const invoice =
        invoices.find((row) => row.id === ticket.invoice_id) ?? invoices[invoices.length - 1];
      const amount =
        invoice?.amount ??
        moneyNear(prose, /(?:invoice|bill|payment)[^\d$]{0,24}\$?([0-9]{2,5}(?:\.\d{2})?)/i);
      if (invoice || amount != null) {
        payment = {
          kind: "invoice",
          refId: invoice?.id ?? ticket.invoice_id,
          amount: amount ?? 0,
          account: "checking",
          payee: invoice?.payee ?? ticket.requester,
          reason: clip(said.boss || bossReport?.summary || "A bill is ready for a person to approve.", 220),
        };
      }
    }
    if (payment && payment.amount <= 0) payment = null;
  }

  const discountNote =
    waiting && !payment && ticket?.type === "price_override"
      ? clip(said.boss || bossReport?.summary || "A person still has to decide the discount. No money leaves on this ticket.", 220)
      : null;

  return { agents, handoffs, payment, discountNote };
}
