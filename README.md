# Landman Copilot - Backend

AI-powered SaaS platform for oil and gas landmen to automate title research and document indexing.

## Project Structure

```
landman-copilot/
├── src/
│   ├── config/           # Configuration files (database, etc.)
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware (auth, validation, etc.)
│   ├── models/           # Database models/queries
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── adapters/         # Portal-specific adapters (idocmarket, etc.)
│   └── utils/            # Helper functions
├── scripts/              # Database and utility scripts
├── uploads/              # File storage for downloaded documents
├── server.js             # Main Express server
├── package.json          # Dependencies
├── .env.example          # Environment variables template
└── schema.sql            # Database schema
```

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create .env file:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Initialize database:**
   ```bash
   npm run db:init
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

The server will run on http://localhost:3000

## API Endpoints (To Be Built)

### Authentication
- `POST /api/auth/register` - Create new user/organization
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update current user
- `GET /api/users` - List organization users (admin only)

### Search Tasks
- `POST /api/search-tasks` - Create new search task
- `GET /api/search-tasks` - List user's search tasks
- `GET /api/search-tasks/:id` - Get search task details
- `PUT /api/search-tasks/:id` - Update search task (priority, etc.)
- `DELETE /api/search-tasks/:id` - Cancel search task

### Documents
- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Get document details
- `POST /api/documents/:id/download` - Download document

### Portals
- `GET /api/portals` - List available portals
- `POST /api/portals/credentials` - Add portal credentials for user
- `GET /api/portals/credentials` - Get user's portal credentials

## Database Schema

See `schema.sql` for complete schema documentation. Key tables:

- **organizations** - Brokerage firms or individual landmen
- **users** - Landmen
- **portals** - Available search portals
- **portal_credentials** - User credentials for each portal
- **search_tasks** - Queued searches
- **search_results** - Index results from searches
- **documents** - Master document records
- **document_instances** - Audit trail of where docs were found
- **document_downloads** - Download history

## Next Steps

1. Build authentication middleware
2. Build user and organization management endpoints
3. Build search task queue management
4. Build idocmarket adapter
5. Build document download and storage logic
