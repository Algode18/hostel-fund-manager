import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Deposit, Expense, Group, Member } from "@/lib/api";

export type { Group, Member, Deposit, Expense, Role } from "@/lib/api";
export { computeBalances, formatINR, formatDate } from "@/lib/api";

const CURRENT_GROUP_KEY = "hostel-fund-current-group";

interface Store {
  groups: Group[];
  currentGroupId: string;
  currentUserId: string;
  deposits: Deposit[];
  expenses: Expense[];
  /** true while the initial groups/deposits/expenses fetch is in flight */
  loading: boolean;
  setCurrentGroupId: (id: string) => void;
  addGroup: (name: string, members: { name: string; email: string }[]) => Promise<string>;
  addMember: (groupId: string, name: string, email: string) => Promise<void>;
  removeMember: (groupId: string, memberId: string) => Promise<void>;
  clearJarBalance: (groupId: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  addDeposit: (groupId: string, memberId: string, amount: number) => Promise<void>;
  addExpense: (input: Parameters<typeof api.addExpense>[0]) => Promise<void>;
  updateExpense: (id: string, patch: Parameters<typeof api.updateExpense>[1]) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const StoreCtx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentGroupId, setCurrentGroupIdState] = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem(CURRENT_GROUP_KEY) : null) ?? "",
  );

  const groupsQuery = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: api.fetchMyGroups,
    enabled: !!user,
    // A user with no jar sits on the empty-state dashboard waiting for an
    // admin to add them to a group elsewhere. Poll occasionally so that
    // once that happens, their dashboard upgrades on its own without
    // requiring a manual refresh (on top of the default refetch-on-focus).
    refetchInterval: (query) => (query.state.data?.length ? false : 15000),
  });

  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);

  // Keep currentGroupId valid: if nothing is selected yet (or the selected
  // group disappeared), fall back to the first group the user belongs to.
  useEffect(() => {
    if (groups.length === 0) return;
    const stillValid = groups.some((g) => g.id === currentGroupId);
    if (!stillValid) {
      setCurrentGroupIdState(groups[0].id);
      localStorage.setItem(CURRENT_GROUP_KEY, groups[0].id);
    }
  }, [groups, currentGroupId]);

  const depositsQuery = useQuery({
    queryKey: ["deposits", currentGroupId],
    queryFn: () => api.fetchDeposits(currentGroupId),
    enabled: !!user && !!currentGroupId,
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", currentGroupId],
    queryFn: () => api.fetchExpenses(currentGroupId),
    enabled: !!user && !!currentGroupId,
  });

  const invalidateGroup = () => {
    queryClient.invalidateQueries({ queryKey: ["deposits", currentGroupId] });
    queryClient.invalidateQueries({ queryKey: ["expenses", currentGroupId] });
  };
  const invalidateGroups = () => queryClient.invalidateQueries({ queryKey: ["groups", user?.id] });

  const currentMember: Member | undefined = useMemo(() => {
    const group = groups.find((g) => g.id === currentGroupId);
    return group?.members.find((m) => m.userId === user?.id);
  }, [groups, currentGroupId, user?.id]);

  const value: Store = {
    groups,
    currentGroupId,
    currentUserId: currentMember?.id ?? "",
    deposits: depositsQuery.data ?? [],
    expenses: expensesQuery.data ?? [],
    loading: groupsQuery.isLoading || depositsQuery.isLoading || expensesQuery.isLoading,

    setCurrentGroupId: (id) => {
      setCurrentGroupIdState(id);
      localStorage.setItem(CURRENT_GROUP_KEY, id);
    },

    addGroup: async (name, members) => {
      const id = await api.createGroupWithMembers(name, members);
      await invalidateGroups();
      setCurrentGroupIdState(id);
      localStorage.setItem(CURRENT_GROUP_KEY, id);
      return id;
    },

    addMember: async (groupId, name, email) => {
      await api.addMember(groupId, name, email);
      await invalidateGroups();
    },

    removeMember: async (groupId, memberId) => {
      await api.removeMember(groupId, memberId);
      await invalidateGroups();
    },

    clearJarBalance: async (groupId) => {
      await api.clearJarBalance(groupId);
      invalidateGroup();
    },

    deleteGroup: async (groupId) => {
      await api.deleteGroup(groupId);
      // The current group is gone — drop it locally so the "fall back to
      // first group" effect above picks a new one (or the empty state)
      // instead of continuing to query a group id that no longer exists.
      if (groupId === currentGroupId) {
        setCurrentGroupIdState("");
        localStorage.removeItem(CURRENT_GROUP_KEY);
      }
      await invalidateGroups();
    },

    addDeposit: async (groupId, memberId, amount) => {
      await api.addDeposit(groupId, memberId, amount);
      invalidateGroup();
    },

    addExpense: async (input) => {
      await api.addExpense(input);
      invalidateGroup();
    },

    updateExpense: async (id, patch) => {
      await api.updateExpense(id, patch);
      invalidateGroup();
    },

    deleteExpense: async (id) => {
      await api.deleteExpense(id);
      invalidateGroup();
    },

    refetch: async () => {
      await Promise.all([groupsQuery.refetch(), depositsQuery.refetch(), expensesQuery.refetch()]);
    },
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const s = useContext(StoreCtx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}

export function useCurrentGroup() {
  const s = useStore();
  return s.groups.find((g) => g.id === s.currentGroupId) ?? s.groups[0];
}

export function useCurrentMember() {
  const s = useStore();
  const g = useCurrentGroup();
  return g?.members.find((m) => m.id === s.currentUserId) ?? g?.members[0];
}