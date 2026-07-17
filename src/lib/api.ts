import { supabase } from "@/lib/supabase";

export type Role = "admin" | "member";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarHue: number;
  userId: string | null;
}

export interface Group {
  id: string;
  name: string;
  createdBy: string;
  members: Member[];
}

export interface Deposit {
  id: string;
  groupId: string;
  memberId: string;
  amount: number;
  createdAt: string;
}

export type SplitType = "equal" | "manual";

export interface ExpenseShare {
  memberId: string;
  amount: number;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  paidBy: string;
  createdBy: string;
  createdAt: string;
  splitType: SplitType;
  shares: ExpenseShare[];
  /** derived from shares — kept so existing code that only needs "who was in on it" still works */
  participantIds: string[];
}

// ---------------------------------------------------------------------------
// mappers: snake_case rows from Postgres -> camelCase app types
// ---------------------------------------------------------------------------
interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_hue: number;
  user_id: string | null;
}

interface DepositRow {
  id: string;
  group_id: string;
  member_id: string;
  amount: number;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  group_id: string;
  title: string;
  amount: number;
  paid_by: string;
  created_by: string;
  created_at: string;
  split_type: SplitType;
  expense_participants?: { member_id: string; share_amount: number }[] | null;
}

function mapMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatarHue: row.avatar_hue,
    userId: row.user_id,
  };
}

function mapDeposit(row: DepositRow): Deposit {
  return {
    id: row.id,
    groupId: row.group_id,
    memberId: row.member_id,
    amount: Number(row.amount),
    createdAt: row.created_at,
  };
}

function mapExpense(row: ExpenseRow): Expense {
  const shares = (row.expense_participants ?? []).map((p) => ({
    memberId: p.member_id,
    amount: Number(p.share_amount),
  }));
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    amount: Number(row.amount),
    paidBy: row.paid_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    splitType: row.split_type,
    shares,
    participantIds: shares.map((s) => s.memberId),
  };
}

/** Turns Postgres/PostgREST errors into short, user-facing messages. */
export function apiErrorMessage(error: unknown): string {
  const err = error as { message?: string; code?: string } | undefined;
  const raw = err?.message ?? String(error);
  if (err?.code === "23503")
    return "That action would break existing records (e.g. a member with expense history).";
  if (err?.code === "23505") return "That already exists.";
  if (/row-level security/i.test(raw)) return "You don't have permission to do that.";
  return raw;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------
export async function fetchMyGroups(): Promise<Group[]> {
  const { data: groups, error } = await supabase
    .from("groups")
    .select("id, name, created_by")
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!groups || groups.length === 0) return [];

  const ids = groups.map((g) => g.id);
  const { data: members, error: mErr } = await supabase
    .from("group_members")
    .select("id, group_id, user_id, name, email, role, avatar_hue")
    .in("group_id", ids);
  if (mErr) throw mErr;

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    createdBy: g.created_by,
    members: (members ?? []).filter((m) => m.group_id === g.id).map(mapMember),
  }));
}

export async function createGroupWithMembers(
  name: string,
  members: { name: string; email: string }[],
): Promise<string> {
  const { data, error } = await supabase.rpc("create_group_with_members", {
    p_name: name,
    p_members: members,
  });
  if (error) throw error;
  return data as string;
}

export async function addMember(groupId: string, name: string, email: string): Promise<void> {
  // Goes through add_group_member() rather than a plain insert so that if
  // this person already has an account, they're linked (user_id set)
  // immediately — otherwise they'd never see the jar until they happened
  // to sign up fresh with that email.
  const { error } = await supabase.rpc("add_group_member", {
    p_group_id: groupId,
    p_name: name,
    p_email: email.toLowerCase(),
  });
  if (error) throw error;
}

export async function removeMember(groupId: string, memberId: string): Promise<void> {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("id", memberId)
    .eq("group_id", groupId);
  if (error) throw error;
}

export async function clearJarBalance(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("clear_jar_balance", { p_group_id: groupId });
  if (error) throw error;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_group", { p_group_id: groupId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------
export async function fetchDeposits(groupId: string): Promise<Deposit[]> {
  const { data, error } = await supabase
    .from("deposits")
    .select("id, group_id, member_id, amount, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDeposit);
}

export async function addDeposit(groupId: string, memberId: string, amount: number): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("deposits").insert({
    group_id: groupId,
    member_id: memberId,
    amount,
    created_by: auth.user.id,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
export async function fetchExpenses(groupId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, group_id, title, amount, paid_by, created_by, created_at, split_type, expense_participants(member_id, share_amount)",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapExpense);
}

/**
 * Splits `amount` evenly across `participantIds`, rounded to the paisa.
 * Division rarely comes out even (e.g. ₹100 / 3 = 33.333...), so any
 * leftover paisa is assigned to the first participant — this keeps the
 * shares summing to exactly `amount`, which create_expense() requires.
 */
export function computeEqualShares(amount: number, participantIds: string[]): ExpenseShare[] {
  if (participantIds.length === 0) return [];
  const base = Math.floor((amount / participantIds.length) * 100) / 100;
  const shares = participantIds.map((memberId) => ({ memberId, amount: base }));
  const remainder = Math.round((amount - base * participantIds.length) * 100) / 100;
  shares[0].amount = Math.round((shares[0].amount + remainder) * 100) / 100;
  return shares;
}

export async function addExpense(input: {
  groupId: string;
  title: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  shares: ExpenseShare[];
}): Promise<void> {
  const { error } = await supabase.rpc("create_expense", {
    p_group_id: input.groupId,
    p_title: input.title,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_shares: input.shares.map((s) => ({ member_id: s.memberId, amount: s.amount })),
    p_split_type: input.splitType,
  });
  if (error) throw error;
}

export async function updateExpense(
  id: string,
  patch: Partial<Pick<Expense, "title" | "amount" | "paidBy">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.paidBy !== undefined) row.paid_by = patch.paidBy;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from("expenses").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export async function updateProfileName(name: string): Promise<void> {
  const { error } = await supabase.rpc("update_my_name", { p_name: name });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Pure helpers (unchanged logic from the original mock store)
// ---------------------------------------------------------------------------
export function computeBalances(group: Group, deposits: Deposit[], expenses: Expense[]) {
  const balances: Record<string, { deposited: number; spent: number; balance: number }> = {};
  for (const m of group.members) balances[m.id] = { deposited: 0, spent: 0, balance: 0 };

  for (const d of deposits) {
    if (d.groupId !== group.id) continue;
    if (balances[d.memberId]) balances[d.memberId].deposited += d.amount;
  }
  for (const e of expenses) {
    if (e.groupId !== group.id) continue;
    for (const s of e.shares) {
      if (balances[s.memberId]) balances[s.memberId].spent += s.amount;
    }
  }
  for (const id of Object.keys(balances)) {
    balances[id].balance = balances[id].deposited - balances[id].spent;
  }
  return balances;
}

export function formatINR(n: number) {
  // Round to the nearest paisa first so floating-point noise (e.g. splitting
  // ₹100 three ways -> 33.333333333336) never leaks into the display, but
  // keep the real fraction instead of collapsing everything to whole rupees.
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  return (
    "₹" +
    rounded.toLocaleString("en-IN", {
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}