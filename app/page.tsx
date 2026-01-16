import Link from "next/link"
import { Database, Plus, Server, BarChart3 } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-4xl w-full px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Database className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Mongoose Show
          </h1>
          <p className="text-xl text-muted-foreground">
            功能完整的 MongoDB 数据库可视化管理工具
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Link
            href="/connections"
            className="group p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-xl transition-all border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">连接管理</h2>
                <p className="text-muted-foreground text-sm">
                  管理多个 MongoDB 连接，支持本地、远程、Atlas 和 SSH 隧道
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/databases"
            className="group p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-xl transition-all border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">数据浏览</h2>
                <p className="text-muted-foreground text-sm">
                  浏览数据库和集合，查看文档内容
                </p>
              </div>
            </div>
          </Link>

          <div className="group p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Plus className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">查询构建器</h2>
                <p className="text-muted-foreground text-sm">
                  可视化构建查询和聚合管道（从集合页面进入）
                </p>
              </div>
            </div>
          </div>

          <div className="group p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <BarChart3 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">数据可视化</h2>
                <p className="text-muted-foreground text-sm">
                  图表展示数据分布和统计信息（从集合页面进入）
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>支持 MongoDB 4.0 及以上版本 | Next.js + shadcn/ui 构建</p>
        </div>
      </div>
    </div>
  )
}
