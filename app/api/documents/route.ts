import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMongoClient } from '@/lib/mongodb/client'
import { getConnection } from '@/lib/config/connections'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { ObjectId } from 'mongodb'

// POST - 创建新文档
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 速率限制
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(ip, '/api/documents')

    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: getRateLimitHeaders('/api/documents'),
        }
      )
    }

    const body = await request.json()
    const { connectionId, databaseName, collectionName, document } = body

    if (!connectionId || !databaseName || !collectionName) {
      return NextResponse.json(
        { error: 'Connection ID, databaseName, and collectionName are required' },
        { status: 400 }
      )
    }

    if (!document || typeof document !== 'object') {
      return NextResponse.json(
        { error: 'Document is required and must be an object' },
        { status: 400 }
      )
    }

    // 从数据库获取连接配置
    const connection = await getConnection(session.user.id, connectionId)

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const client = await getMongoClient(connection)
    const db = client.db(databaseName)
    const collection = db.collection(collectionName)

    // 插入文档
    const result = await collection.insertOne(document)

    // 返回插入的文档（包含 _id）
    const insertedDocument = await collection.findOne({ _id: result.insertedId })

    return NextResponse.json({
      success: true,
      document: insertedDocument,
      message: '文档创建成功'
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create document',
      },
      { status: 500 }
    )
  }
}

// PUT - 更新文档
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 速率限制
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(ip, '/api/documents')

    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: getRateLimitHeaders('/api/documents'),
        }
      )
    }

    const body = await request.json()
    const { connectionId, databaseName, collectionName, documentId, update, upsert } = body

    if (!connectionId || !databaseName || !collectionName) {
      return NextResponse.json(
        { error: 'Connection ID, databaseName, and collectionName are required' },
        { status: 400 }
      )
    }

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    if (!update || typeof update !== 'object') {
      return NextResponse.json(
        { error: 'Update data is required and must be an object' },
        { status: 400 }
      )
    }

    // 从数据库获取连接配置
    const connection = await getConnection(session.user.id, connectionId)

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const client = await getMongoClient(connection)
    const db = client.db(databaseName)
    const collection = db.collection(collectionName)

    // 构建 MongoDB 查询
    let ObjectIdValue
    try {
      ObjectIdValue = ObjectId.createFromHexString(documentId)
    } catch {
      try {
        ObjectIdValue = new ObjectId(documentId)
      } catch {
        ObjectIdValue = documentId
      }
    }

    // 移除 _id 字段，不允许更新
    const { _id, ...cleanUpdate } = update

    // 更新文档
    const result = await collection.updateOne(
      { _id: ObjectIdValue },
      { $set: cleanUpdate },
      { upsert: upsert || false }
    )

    if (result.matchedCount === 0 && !upsert) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // 获取更新后的文档
    const updatedDocument = await collection.findOne({ _id: ObjectIdValue })

    return NextResponse.json({
      success: true,
      document: updatedDocument,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
      message: '文档更新成功'
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update document',
      },
      { status: 500 }
    )
  }
}

// DELETE - 删除文档
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 速率限制
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(ip, '/api/documents')

    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: getRateLimitHeaders('/api/documents'),
        }
      )
    }

    const body = await request.json()
    const { connectionId, databaseName, collectionName, documentId } = body

    if (!connectionId || !databaseName || !collectionName) {
      return NextResponse.json(
        { error: 'Connection ID, databaseName, and collectionName are required' },
        { status: 400 }
      )
    }

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // 从数据库获取连接配置
    const connection = await getConnection(session.user.id, connectionId)

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const client = await getMongoClient(connection)
    const db = client.db(databaseName)
    const collection = db.collection(collectionName)

    // 构建 MongoDB 查询
    let ObjectIdValue
    try {
      ObjectIdValue = ObjectId.createFromHexString(documentId)
    } catch {
      try {
        ObjectIdValue = new ObjectId(documentId)
      } catch {
        ObjectIdValue = documentId
      }
    }

    // 删除文档
    const result = await collection.deleteOne({ _id: ObjectIdValue })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: '文档删除成功'
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete document',
      },
      { status: 500 }
    )
  }
}
