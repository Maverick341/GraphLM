# Express Auth Boilerplate

A modular authentication boilerplate built with Express.js. Includes JWT-based authentication, Google and GitHub OAuth (custom implementation), avatar uploads with Cloudinary, route protection, and Swagger API documentation.

---

### Features
- JWT-based authentication (login & register)
- Social login with Google and GitHub (custom OAuth flow)
- Avatar upload with Multer and Cloudinary
- Input validation with express-validator
- Protected routes with middleware
- Email testing using Mailtrap + Nodemailer
- Swagger UI integration for API docs at /api-docs
- Modular folder structure for scalability

---

### Tech Stack
- Node.js + Express.js
- MongoDB + Mongoose
- JWT, bcrypt
- Multer, Cloudinary
- Nodemailer, Mailtrap
- Custom OAuth (Google & GitHub)
- Swagger (OpenAPI 3.0)

---

### Folder Structure

```
project-root/
├── public/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── db/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── app.js
│   └── index.js
├── .env
├── .env.sample
├── .gitignore
├── package.json
├── README.md
```

---

### Getting Started

1. Clone the repository:
```bash
git clone https://github.com/your-username/express-auth-boilerplate.git
cd express-auth-boilerplate
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
- Rename `.env.sample` to `.env` and fill out the following:

```txt
NODE_ENV=development

PORT=your-port
CLIENT_URL=your-frontend-url
BASE_URL=your-frontend-base-url
MONGO_URL=your-mongodb-cluster-url

CORS_ORIGIN=*

# Mailtrap SMTP Credentials (Replace with your actual Mailtrap details)
MAILTRAP_SMTP_HOST=smtp.mailtrap.io
MAILTRAP_SMTP_PORT=587
MAILTRAP_SMTP_USER=your_mailtrap_username
MAILTRAP_SMTP_PASS=your_mailtrap_password

# Email Sender
MAILTRAP_SENDEREMAIL=your_sender_email@example.com  # Use a verified email

TEMP_TOKEN_SECRET=...

ACCESS_TOKEN_SECRET=...
ACCESS_TOKEN_EXPIRY=...
REFRESH_TOKEN_SECRET=...
REFRESH_TOKEN_EXPIRY=...

# Google OAuth Credentials
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...

# Google JWKS (JSON Web Key Set) URL for JWT Validation
GOOGLE_JWKS_URL=https://www.googleapis.com/oauth2/v3/certs

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=...


FORGOT_PASSWORD_REDIRECT_URL=...

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

4. Run the development server:
```bash
npm run dev
```
---
### API Endpoints

| Method | Route                             | Description                              |
|--------|-----------------------------------|------------------------------------------|
| POST   | `/register`                       | Register a new user                      |
| POST   | `/login`                          | Login user                               |
| GET    | `/verifyEmail/:token`            | Verify email using token                 |
| POST   | `/resendVerifyEmail`             | Resend verification email                |
| GET    | `/refreshAccessToken`            | Refresh access token using cookie        |
| GET    | `/profile`                        | Get current logged-in user's profile     |
| GET    | `/logout`                         | Log out current user                     |
| POST   | `/forgotPassword`                | Request password reset email             |
| POST   | `/resetPassword/:token`          | Reset password using token               |
| POST   | `/updateProfile`                 | Update user profile                      |
| PATCH  | `/updateAvatar`                  | Update or upload avatar image            |
| GET    | `/google`                         | Initiate Google OAuth login              |
| GET    | `/google/callback`               | Google OAuth callback                    |
| POST   | `/set-google-oauth-username`     | Set username after Google OAuth login    |
| GET    | `/github`                         | Initiate GitHub OAuth login              |
| GET    | `/github/callback`               | GitHub OAuth callback                    |


---
### API Documentation
- Swagger UI available at: `http://localhost:${PORT}/api/v1/api-docs`

---

### License
Licensed under the MIT License.
