import { create } from 'zustand'
import type { Tournament } from '@/types/domain'

interface TournamentsState {
  tournaments: Tournament[]
  isLoading: boolean
  error: string | null
  fetchTournaments: () => Promise<void>
  createTournament: (t: Omit<Tournament, 'id' | 'createdAt'>) => Promise<Tournament>
  updateTournament: (id: number, data: Partial<Omit<Tournament, 'id' | 'createdAt'>>) => Promise<void>
  deleteTournament: (id: number) => Promise<void>
}

export const useTournamentsStore = create<TournamentsState>((set) => ({
  tournaments: [],
  isLoading: false,
  error: null,

  fetchTournaments: async () => {
    set({ isLoading: true, error: null })
    try {
      const tournaments = await window.db.getTournaments()
      set({ tournaments, isLoading: false })
    } catch (e) {
      set({ error: String(e), isLoading: false })
    }
  },

  createTournament: async (t) => {
    const created = await window.db.createTournament(t)
    set((state) => ({ tournaments: [...state.tournaments, created] }))
    return created
  },

  updateTournament: async (id, data) => {
    const updated = await window.db.updateTournament(id, data)
    set((state) => ({
      tournaments: state.tournaments.map((t) => (t.id === id ? updated : t)),
    }))
  },

  deleteTournament: async (id) => {
    await window.db.deleteTournament(id)
    set((state) => ({ tournaments: state.tournaments.filter((t) => t.id !== id) }))
  },
}))
