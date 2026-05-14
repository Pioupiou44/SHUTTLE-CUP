import { create } from 'zustand'
import type { Player } from '@/types/domain'

interface PlayersState {
  players: Player[]
  isLoading: boolean
  error: string | null
  fetchPlayers: () => Promise<void>
  createPlayer: (player: Omit<Player, 'id' | 'createdAt'>) => Promise<Player>
  updatePlayer: (id: number, data: Partial<Omit<Player, 'id' | 'createdAt'>>) => Promise<void>
  deletePlayer: (id: number) => Promise<void>
}

export const usePlayersStore = create<PlayersState>((set) => ({
  players: [],
  isLoading: false,
  error: null,

  fetchPlayers: async () => {
    set({ isLoading: true, error: null })
    try {
      const players = await window.db.getPlayers()
      set({ players, isLoading: false })
    } catch (e) {
      set({ error: String(e), isLoading: false })
    }
  },

  createPlayer: async (player) => {
    const created = await window.db.createPlayer(player)
    set((state) => ({ players: [...state.players, created] }))
    return created
  },

  updatePlayer: async (id, data) => {
    const updated = await window.db.updatePlayer(id, data)
    set((state) => ({
      players: state.players.map((p) => (p.id === id ? updated : p)),
    }))
  },

  deletePlayer: async (id) => {
    await window.db.deletePlayer(id)
    set((state) => ({ players: state.players.filter((p) => p.id !== id) }))
  },
}))
