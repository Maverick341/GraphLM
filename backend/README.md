# GraphLM Backend API

A Node.js + Express backend for multi-source knowledge indexing and chat reasoning. Supports PDF documents and GitHub repositories with vector embeddings and knowledge graph construction.

---

### Features
- Multi-source indexing (PDF + GitHub)
- Vector embeddings with Qdrant
- Knowledge graph with Neo4j
- JWT authentication + OAuth 2.0
- Chat session management
- Avatar uploads with Cloudinary
- Swagger API documentation

---

### Tech Stack
- **Runtime**: Node.js + Express.js
- **Databases**: MongoDB, Neo4j, Qdrant
- **Auth**: JWT, bcrypt, OAuth 2.0
- **LLM**: LangChain, OpenAI
- **File Uploads**: Multer, Cloudinary

---

### Setup

1. Install dependencies:
```bash
npm install
```

2. Configure `.env`:
```txt
NODE_ENV=development
PORT=5000
MONGO_URL=your-mongodb-url
NEO4J_URI=your-neo4j-url
NEO4J_USERNAME=username
NEO4J_PASSWORD=password
QDRANT_URL=http://localhost:6333
OPENAI_API_KEY=your-key
OPENAI_LLM_MODEL=gpt-4

# Auth tokens
ACCESS_TOKEN_SECRET=secret
REFRESH_TOKEN_SECRET=secret

# OAuth
GOOGLE_CLIENT_ID=id
GOOGLE_CLIENT_SECRET=secret
GITHUB_CLIENT_ID=id
GITHUB_CLIENT_SECRET=secret

# Email
MAILTRAP_SMTP_HOST=smtp.mailtrap.io
MAILTRAP_SMTP_USER=user
MAILTRAP_SMTP_PASS=pass

# Upload
CLOUDINARY_CLOUD_NAME=name
CLOUDINARY_API_KEY=key
CLOUDINARY_API_SECRET=secret
```

3. Run:
```bash
npm run dev
```

---

### API Endpoints

**Auth**
- `POST /auth/register` - Register user
- `POST /auth/login` - Login user
- `GET /auth/google` - Google OAuth
- `GET /auth/github` - GitHub OAuth

**Sources**
- `POST /sources` - Create PDF source
- `POST /sources/github` - Create GitHub source
- `GET /sources` - List sources
- `GET /sources/:id` - Get source
- `DELETE /sources/:id` - Delete source

**Chat**
- `POST /chat` - Create session
- `POST /chat/:id/messages` - Send message
- `GET /chat/:id` - Get chat

**Health**
- `GET /health` - Health check

---

### Docs
- Swagger UI: `http://localhost:5000/api/v1/api-docs`

---

### License
MIT
