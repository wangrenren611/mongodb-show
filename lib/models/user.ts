import { MongoClient, Db } from 'mongodb'
import bcrypt from 'bcryptjs'

if (!process.env.MONGODB_URI) {
  throw new Error('Please add the Mongo URI to .env.local')
}

const uri = process.env.MONGODB_URI
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

export interface User {
  _id?: string
  email: string
  password: string
  name: string
  createdAt: Date
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const client = await clientPromise
  const db = client.db('mongoose-show-auth')

  const user = await db.collection<User>('users').findOne({ email })
  return user
}

export async function createUser(email: string, password: string, name: string): Promise<User> {
  const client = await clientPromise
  const db = client.db('mongoose-show-auth')

  const hashedPassword = await bcrypt.hash(password, 10)

  const user: User = {
    email,
    password: hashedPassword,
    name,
    createdAt: new Date(),
  }

  const result = await db.collection<User>('users').insertOne(user)

  return {
    ...user,
    _id: result.insertedId.toString(),
  }
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export default clientPromise
