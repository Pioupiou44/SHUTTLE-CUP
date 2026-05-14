import { create } from 'zustand'
import type { ScoringRule } from '@/types/domain'

interface RulesState {
  rules: ScoringRule[]
  isLoading: boolean
  error: string | null
  fetchRules: () => Promise<void>
  createRule: (rule: Omit<ScoringRule, 'id' | 'isCustom'>) => Promise<ScoringRule>
  updateRule: (id: number, data: Partial<Omit<ScoringRule, 'id' | 'isCustom'>>) => Promise<void>
  deleteRule: (id: number) => Promise<void>
}

export const useRulesStore = create<RulesState>((set) => ({
  rules: [],
  isLoading: false,
  error: null,

  fetchRules: async () => {
    set({ isLoading: true, error: null })
    try {
      const rules = await window.db.getScoringRules()
      set({ rules, isLoading: false })
    } catch (e) {
      set({ error: String(e), isLoading: false })
    }
  },

  createRule: async (rule) => {
    const created = await window.db.createScoringRule(rule)
    set((state) => ({ rules: [...state.rules, created] }))
    return created
  },

  updateRule: async (id, data) => {
    const updated = await window.db.updateScoringRule(id, data)
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? updated : r)),
    }))
  },

  deleteRule: async (id) => {
    await window.db.deleteScoringRule(id)
    set((state) => ({ rules: state.rules.filter((r) => r.id !== id) }))
  },
}))
