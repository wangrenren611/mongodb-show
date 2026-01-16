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

### Directory Structure

```
app/                          # Next.js App Router
  ├── layout.tsx              # Root layout with theme provider
  ├── page.tsx                # Landing page
  ├── connections/page.tsx    # Connection management UI
  ├── databases/page.tsx      # Database/collection browser
  ├── documents/page.tsx      # Document viewer
  ├── query/page.tsx          # Query builder
  ├── charts/page.tsx         # Data visualization
  └── api/connections/        # API routes for MongoDB operations
      ├── test/route.ts       # Connection testing
      ├── databases/route.ts  # List databases
      ├── collections/route.ts # List collections with stats
      ├── documents/route.ts  # Query/fetch documents
      └── aggregate/route.ts  # Aggregation pipeline

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
  │   └── client.ts           # MongoDB connection management (pooling, caching)
  ├── store/
  │   └── connection-store.ts # Zustand store for connections
  └── utils.ts               # Utility functions

types/
  └── index.ts               # TypeScript definitions
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
All API routes are POST endpoints that accept a `connection` object:
```typescript
{
  connection: MongoConnection,  // Connection config or connection string
  databaseName: string,
  collectionName: string,
  query?: QueryParams,
  pipeline?: AggregateStage[]
}
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
- `MongoConnection` - Connection config with SSH tunnel support
- `DatabaseInfo`, `CollectionInfo` - Metadata with storage stats
- `IndexInfo` - Index definitions
- `QueryParams` - Find query parameters (filter, sort, projection, skip, limit)
- `AggregateStage` - Aggregation pipeline stages
- `DocumentViewType` - 'table' | 'json' | 'tree'

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
