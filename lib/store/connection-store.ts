import { create } from 'zustand'
import type { MongoConnection, ConnectionStatus } from '@/types'

interface ConnectionState {
  connections: MongoConnection[]
  connectionStatus: Record<string, ConnectionStatus>
  isLoading: boolean
  isInitialized: boolean

  // Actions
  initialize: () => Promise<void>
  saveConfig: () => Promise<void>
  addConnection: (connection: Omit<MongoConnection, 'id' | 'createdAt' | 'userId'>) => Promise<void>
  updateConnection: (id: string, connection: Partial<MongoConnection>) => Promise<void>
  removeConnection: (id: string) => Promise<void>
  setConnectionStatus: (id: string, status: ConnectionStatus) => void
  getConnection: (id: string) => MongoConnection | undefined
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  connections: [],
  connectionStatus: {},
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    const { isInitialized } = get()
    if (isInitialized) return

    set({ isLoading: true })
    try {
      const response = await fetch('/api/connections/config')
      if (response.ok) {
        const data = await response.json()
        set({
          connections: data.connections || [],
          isInitialized: true,
        })
      }
    } catch (error) {
      console.error('Failed to initialize connections:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  saveConfig: async () => {
    const { connections } = get()
    try {
      await fetch('/api/connections/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connections, activeConnectionId: null }),
      })
    } catch (error) {
      console.error('Failed to save connections config:', error)
    }
  },

  addConnection: async (connection) => {
    // 获取当前用户 ID
    const sessionResponse = await fetch('/api/auth/session')
    const session = await sessionResponse.json()

    if (!session?.user?.id) {
      throw new Error('User not authenticated')
    }

    const newConnection: MongoConnection = {
      ...connection,
      id: crypto.randomUUID(),
      userId: session.user.id,
      createdAt: new Date(),
    }
    set((state) => ({
      connections: [...state.connections, newConnection],
    }))
    await get().saveConfig()
  },

  updateConnection: async (id, connection) => {
    set((state) => ({
      connections: state.connections.map((conn) =>
        conn.id === id ? { ...conn, ...connection } : conn
      ),
    }))
    await get().saveConfig()
  },

  removeConnection: async (id) => {
    set((state) => ({
      connections: state.connections.filter((conn) => conn.id !== id),
      connectionStatus: { ...state.connectionStatus, [id]: 'disconnected' },
    }))
    await get().saveConfig()
  },

  setConnectionStatus: (id, status) => {
    set((state) => ({
      connectionStatus: { ...state.connectionStatus, [id]: status },
    }))
  },

  getConnection: (id) => {
    return get().connections.find((conn) => conn.id === id)
  },
}))
