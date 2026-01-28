import { create } from 'zustand'
import type { DatabaseConnection, ConnectionStatus } from '@/types'
import { isMongoConnection, isPostgresConnection } from '@/types/database'

interface ConnectionState {
  connections: DatabaseConnection[]
  connectionStatus: Record<string, ConnectionStatus>
  isLoading: boolean
  isInitialized: boolean

  // Actions
  initialize: () => Promise<void>
  saveConfig: () => Promise<void>
  addConnection: (connection: Omit<DatabaseConnection, 'id' | 'createdAt' | 'userId'>) => Promise<void>
  updateConnection: (id: string, connection: Partial<DatabaseConnection>) => Promise<void>
  removeConnection: (id: string) => Promise<void>
  setConnectionStatus: (id: string, status: ConnectionStatus) => void
  getConnection: (id: string) => DatabaseConnection | undefined
  reconnectAll: () => Promise<void>
  testConnection: (connection: DatabaseConnection) => Promise<{ success: boolean; error?: string }>
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

    const newConnection: DatabaseConnection = {
      ...connection,
      id: crypto.randomUUID(),
      userId: session.user.id,
      createdAt: new Date(),
    } as DatabaseConnection

    // 根据连接类型选择不同的 API
    const apiPath = connection.type === 'postgresql'
      ? '/api/connections/add-postgresql'
      : '/api/connections/add'

    const response = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConnection),
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to add connection')
    }

    // 强制重新初始化连接列表（不包含密码）
    set({ isInitialized: false })
    await get().initialize()
  },

  updateConnection: async (id, connection) => {
    set((state) => ({
      connections: state.connections.map((conn) =>
        conn.id === id ? { ...conn, ...connection } as DatabaseConnection : conn
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

  reconnectAll: async () => {
    const { connections } = get()
    if (connections.length === 0) return

    // 设置所有连接状态为 connecting
    const statuses: Record<string, ConnectionStatus> = {}
    connections.forEach((conn) => {
      statuses[conn.id] = 'connecting'
    })
    set({ connectionStatus: statuses })

    // 并发测试所有连接
    const results = await Promise.allSettled(
      connections.map(async (connection) => {
        try {
          // 根据连接类型选择不同的 API
          const apiPath = connection.type === 'postgresql'
            ? '/api/postgresql/test'
            : '/api/connections/test'

          const response = await fetch(apiPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: connection.id }),
          })
          const result = await response.json()
          return { id: connection.id, success: result.success }
        } catch {
          return { id: connection.id, success: false }
        }
      })
    )

    // 更新连接状态
    const newStatuses: Record<string, ConnectionStatus> = {}
    results.forEach((result, index) => {
      const connectionId = connections[index].id
      if (result.status === 'fulfilled' && result.value.success) {
        newStatuses[connectionId] = 'connected'
      } else {
        newStatuses[connectionId] = 'error'
      }
    })
    set({ connectionStatus: newStatuses })
  },

  testConnection: async (connection) => {
    try {
      // 根据连接类型选择不同的 API
      const apiPath = connection.type === 'postgresql'
        ? '/api/postgresql/test'
        : '/api/connections/test'

      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id }),
      })
      const result = await response.json()
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
}))
