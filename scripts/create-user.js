import bcrypt from 'bcryptjs'
import { MongoClient } from 'mongodb'
import readline from 'readline'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function createUser() {
  console.log('\n=== 创建新用户 ===\n')

  const email = await question('请输入邮箱: ')
  const password = await question('请输入密码: ')
  const name = await question('请输入姓名: ')

  if (!email || !password || !name) {
    console.log('错误: 所有字段都必须填写')
    rl.close()
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mongoose-show-auth'

  try {
    const client = new MongoClient(uri)
    await client.connect()
    console.log('\n已连接到数据库')

    const db = client.db()

    // 检查用户是否已存在
    const existingUser = await db.collection('users').findOne({ email })
    if (existingUser) {
      console.log(`\n错误: 邮箱 ${email} 已被注册`)
      rl.close()
      process.exit(1)
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建用户
    const result = await db.collection('users').insertOne({
      email,
      password: hashedPassword,
      name,
      createdAt: new Date()
    })

    console.log(`\n✓ 用户创建成功!`)
    console.log(`  邮箱: ${email}`)
    console.log(`  姓名: ${name}`)
    console.log(`  用户ID: ${result.insertedId}`)

    await client.close()
  } catch (error) {
    console.error('\n错误:', error.message)
    process.exit(1)
  }

  rl.close()
}

createUser()
