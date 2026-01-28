# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mongoose Show is a MongoDB database visualization and management tool built with Next.js 15, React 19, and TypeScript. It provides a web UI for browsing databases, collections, documents, running queries, and visualizing data.

## Commands

```bash
# Development
npm run dev          # Start development server on http://localhost:3000

# Production
npm run build        # Create production build
npm run start        # Run production server

# Code Quality
npm run lint         # Run ESLint

# User Management
npm run create-user  # Create admin user (runs scripts/create-user.js)
```

## Architecture

### Tech Stack
- **Next.js 15** with App Router (React Server Components where applicable)
- **TypeScript** with strict mode
- **shadcn/ui** + **Radix UI** for component library
- **Tailwind CSS** for styling (with dark mode)
- **Zustand** for global state management (localStorage persisted)
- **MongoDB Node.js Driver** for database operations
- **Recharts** for data visualization
- **NextAuth.js v4** for authentication (JWT sessions, bcrypt password hashing)
- **Monaco Editor** for code editing (JSON/aggregate pipeline editor)

### Directory Structure

```
app/                          # Next.js App Router
  ├── layout.tsx              # Root layout with theme provider
  ├── page.tsx                # Landing page
  ├── login/page.tsx          # Login page
  ├── connections/page.tsx    # Connection management UI
  ├── databases/page.tsx      # Database/collection browser
  ├── documents/page.tsx      # Document viewer
  ├── query/page.tsx          # Query builder
  └── charts/page.tsx         # Data visualization

app/api/                      # API routes (all require authentication)
  ├── auth/
  │   ├── [...nextauth]/route.ts  # NextAuth.js authentication
  │   ├── register/route.ts       # User registration
  │   └── session/route.ts        # Session verification
  ├── connections/
  │   ├── test/route.ts       # Connection testing
  │   ├── databases/route.ts  # List databases
  │   ├── collections/route.ts # List collections with stats
  │   ├── documents/route.ts  # Query/fetch documents
  │   ├── aggregate/route.ts  # Aggregation pipeline
  │   ├── add/route.ts        # Add new connection
  │   └── config/route.ts     # Get user connection config
  └── documents/route.ts      # Document CRUD operations

components/
  ├── ui/                     # shadcn/ui components (button, card, dialog, etc.)
  ├── connection/             # Connection-specific components
  ├── database-tree/          # Database navigation tree
  ├── document-viewer/        # Document display components
  ├── query-builder/          # Query construction UI
  ├── charts/                 # Data visualization components
  └── layout/
      ├── theme-provider.tsx  # Dark/light theme switching
      └── use-toast.ts        # Toast notifications

lib/
  ├── mongodb/
  │   ├── client.ts           # MongoDB connection management (pooling, caching)
  │   └── sanitize.ts         # NoSQL injection prevention (query operator whitelisting)
  ├── config/
  │   └── connections.ts      # Connection CRUD with user isolation
  ├── models/
  │   └── user.ts             # User model (bcrypt password hashing)
  ├── auth.ts                 # NextAuth configuration
  ├── rate-limit.ts           # In-memory rate limiting per endpoint
  ├── store/
  │   └── connection-store.ts # Zustand store for connections
  └── utils/                  # Utility functions
      └── xss.ts              # XSS prevention utilities

types/
  └── index.ts               # TypeScript definitions

scripts/
  └── create-user.js         # Admin user creation script
```

### Key Architecture Patterns

#### MongoDB Connection System
Located in `lib/mongodb/client.ts`:
- Connection pooling with configurable min/max pool sizes
- Connection caching using a Map (connection ID → MongoClient)
- Automatic reconnection on connection failure
- Support for custom connection strings (full Atlas connection strings)
- SRV record support (`mongodb+srv://` protocol)

The `buildConnectionString()` function handles:
- Standard connections: `mongodb://host:port`
- SRV connections: `mongodb+srv://host` (for Atlas)
- Custom connection strings (passthrough)
- Authentication with username/password
- Auth source and auth mechanism parameters

#### State Management (Zustand)
`lib/store/connection-store.ts`:
- Stores connection configurations with localStorage persistence
- Tracks active connection
- Tracks connection status (disconnected/connecting/connected/error)
- CRUD operations for connections
- State is serialized to localStorage (handles Date serialization)

#### API Routes
All API routes are POST endpoints that require authentication. Most routes now accept `connectionId` instead of full connection object for security:

```typescript
// Standard request format
{
  connectionId: string,  // ID of stored connection (user must own it)
  databaseName: string,
  collectionName: string,
  query?: QueryParams,
  pipeline?: AggregateStage[]
}
```

Example API route pattern:
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getConnection } from '@/lib/config/connections'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // 1. Check rate limit
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const rateLimitCheck = checkRateLimit(ip, '/api/connections/test')
  if (!rateLimitCheck.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // 2. Verify authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 3. Get connection (verifies ownership)
  const { connectionId } = await request.json()
  const connection = await getConnection(session.user.id, connectionId)
  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // 4. Proceed with MongoDB operation
  // ...
}
```

#### Authentication System (NextAuth.js)
Located in `lib/auth.ts` and `app/api/auth/`:
- JWT-based session management (sessions stored in secure cookies)
- Password hashing with bcrypt (10 rounds)
- User registration with password strength validation
- CSRF protection enabled by NextAuth
- All API routes require valid session via `getServerSession(authOptions)`

User model (`lib/models/user.ts`):
- `createUser()` - Hashes password before storing
- `getUserByEmail()` - Retrieves user without password
- `verifyPassword()` - Compares password hash

#### User Isolation & Security
All connections are user-scoped:
- API routes accept `connectionId` instead of full connection object
- Server validates `session.user.id` matches `connection.userId`
- `getConnection(userId, connectionId)` enforces ownership
- Sensitive data (passwords, connection strings) stripped in API responses (`hasCredentials: true` flag used instead)

#### Rate Limiting
`lib/rate-limit.ts` implements in-memory rate limiting:
- Login: 5 requests/minute
- Register: 3 requests/5 minutes
- Connection test: 10 requests/minute
- Connection add: 5 requests/minute
- Default: 100 requests/minute

Usage:
```typescript
import { checkRateLimit } from '@/lib/rate-limit'
const ip = request.headers.get('x-forwarded-for') || 'unknown'
const check = checkRateLimit(ip, '/api/connections/test')
if (!check.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
```

#### NoSQL Injection Prevention
`lib/mongodb/sanitize.ts` provides query sanitization:
- Whitelist of allowed query operators (`$eq`, `$ne`, `$gt`, `$in`, etc.)
- Blacklist of dangerous operators (`$where`, `$function`, `$eval`, `$expr`)
- Whitelist of allowed aggregation stages (`$match`, `$group`, `$project`, etc.)
- Maximum query depth of 10 levels

Usage:
```typescript
import { sanitizeQueryParams, sanitizePipeline } from '@/lib/mongodb/sanitize'
const queryParams = sanitizeQueryParams(body.query || {})
const sanitizedPipeline = sanitizePipeline(pipeline)
```

#### Client Components with useSearchParams
Pages that use `useSearchParams` must be wrapped in `Suspense` to avoid Next.js build errors:
```typescript
function PageContent() {
  const searchParams = useSearchParams()  // Safe inside Suspense
  // ...
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PageContent />
    </Suspense>
  )
}
```

### Type Definitions (`types/index.ts`)

Key types:
- `MongoConnection` - Connection config with SSH tunnel support, user ownership, and credential flag
- `ConnectionStatus` - 'disconnected' | 'connecting' | 'connected' | 'error'
- `DatabaseInfo`, `CollectionInfo` - Metadata with storage stats
- `IndexInfo` - Index definitions
- `QueryParams` - Find query parameters (filter, sort, projection, skip, limit)
- `AggregateStage` - Aggregation pipeline stages
- `ChartType` - 'bar' | 'line' | 'pie' | 'area'
- `DocumentViewType` - 'table' | 'json' | 'tree'

NextAuth type extensions are also defined here for Session and User with `id` field.

## Important Implementation Details

### Connection String Support
Users can provide MongoDB connections in two ways:
1. **Individual parameters** - host, port, username, password, auth DB, auth mechanism, SRV flag
2. **Custom connection string** - Full MongoDB URI (useful for Atlas)

When `connection.connectionString` is provided, it overrides all other connection parameters.

### SRV Connections (MongoDB Atlas)
Must use `mongodb+srv://` protocol (not `mongodb://`). The connection builder handles this correctly when `srv: true`.

### MongoDB Driver Usage
- Use `getMongoClient()` to get/reuse connections
- Connections are cached per connection ID
- Always call `client.connect()` before use (idempotent)
- Use `collection.estimatedDocumentCount()` for fast counts
- Use aggregation `$collStats` for collection statistics
- Use projection to limit fields returned

### UI Components
- All shadcn/ui components are in `components/ui/`
- Uses class-variance-authority for variant styling
- Tailwind merge for className concatenation (`cn()` utility)
- Dark mode handled by `next-themes` with class strategy

## Security Considerations

This application implements multiple security layers:

### Authentication & Authorization
- **NextAuth.js** with JWT sessions stored in httpOnly cookies
- **bcrypt** password hashing (10 rounds)
- **CSRF protection** enabled via NextAuth
- **User isolation** - all MongoDB operations verify connection ownership

### Input Validation & Sanitization
- **NoSQL injection prevention** via operator whitelisting (`lib/mongodb/sanitize.ts`)
- **Rate limiting** on all endpoints (`lib/rate-limit.ts`)
- **Password strength validation** (8+ chars, mixed case, numbers, special chars)
- **XSS prevention** utilities in `lib/utils/xss.ts`

### Data Protection
- **Passwords never returned** to client (stripped from API responses)
- **Connection strings hidden** - `hasCredentials` flag indicates presence
- **Secure cookies** in production (`useSecureCookies: true`)

### Configuration
- **Request body size limit**: 2MB (configured in `next.config.mjs`)
- **Environment variables**: `NEXTAUTH_SECRET`, `MONGODB_URI` required

See `SECURITY_AUDIT.md` for detailed security assessment and `SECURITY_FIXES.md` for implementation guide.
