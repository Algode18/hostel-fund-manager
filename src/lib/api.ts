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

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  paidBy: string;
  createdBy: string;
  createdAt: string;
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
  expense_participants?: { member_id: string }[] | null;
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
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    amount: Number(row.amount),
    paidBy: row.paid_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    participantIds: (row.expense_participants ?? []).map((p) => p.member_id),
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
      "id, group_id, title, amount, paid_by, created_by, created_at, expense_participants(member_id)",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapExpense);
}

export async function addExpense(input: {
  groupId: string;
  title: string;
  amount: number;
  paidBy: string;
  participantIds: string[];
}): Promise<void> {
  const { error } = await supabase.rpc("create_expense", {
    p_group_id: input.groupId,
    p_title: input.title,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_participant_ids: input.participantIds,
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
    const share = e.amount / (e.participantIds.length || 1);
    for (const pid of e.participantIds) {
      if (balances[pid]) balances[pid].spent += share;
    }
  }
  for (const id of Object.keys(balances)) {
    balances[id].balance = balances[id].deposited - balances[id].spent;
  }
  return balances;
}

export function formatINR(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
