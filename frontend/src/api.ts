export const API = "http://localhost:8000";

export type Ticket = {
  id: number;
  type: string;
  requester: string;
  subject: string;
  status: string;
  sku: string | null;
  size: string | null;
  qty: number | null;
  lease_id: number | null;
  invoice_id: number | null;
  notes: string | null;
};

export type CashAccount = {
  account: string;
  balance: number;
  date: string;
};

export type AuditEvent = {
  recorded_at: string;
  agent: string;
  kind: string;
  depth: number;
  detail: Record<string, unknown>;
};

export type AgentReport = {
  summary: string;
  facts: string[];
  waiting_on_human: boolean;
  draft_for_the_board: string | null;
};

export type ApprovalRequest = {
  kind: "invoice" | "rent";
  ref_id: number;
  amount: number;
  approved_by: string;
  account: string;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    const detail = body.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "reason" in detail) {
      const reason = (detail as { reason?: unknown }).reason;
      if (typeof reason === "string") return reason;
    }
    return `The desk returned ${response.status}.`;
  } catch {
    return `The desk returned ${response.status}.`;
  }
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`);
  } catch {
    throw new Error("The back room isn't answering. Start the desk API on port 8000.");
  }
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

export async function getTickets(): Promise<Ticket[]> {
  const body = await getJson<{ tickets: Ticket[] }>("/tickets");
  return body.tickets;
}

export async function getCash(): Promise<CashAccount> {
  return getJson<CashAccount>("/cash");
}

export async function getEvents(limit = 200): Promise<AuditEvent[]> {
  const body = await getJson<{ events: AuditEvent[] }>(`/events?limit=${limit}`);
  return body.events;
}

export async function runTicket(ticketId: number): Promise<AgentReport> {
  let response: Response;
  try {
    response = await fetch(`${API}/tickets/${ticketId}/run`, { method: "POST" });
  } catch {
    throw new Error("The back room isn't answering. Start the desk API on port 8000.");
  }
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { report: AgentReport };
  return body.report;
}

export async function approvePayment(body: ApprovalRequest): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("The back room isn't answering. Start the desk API on port 8000.");
  }
  if (!response.ok) throw new Error(await readError(response));
}
