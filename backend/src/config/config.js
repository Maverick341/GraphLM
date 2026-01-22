/**
 * Centralized environment variables configuration
 * All env variables used across the application are defined here
 */

export const config = {
  // Server Configuration
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  BASE_URL: process.env.BASE_URL || "http://localhost:4000/",

  // Database Configuration
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI,
  NEO4J_URI: process.env.NEO4J_URI,
  NEO4J_USERNAME: process.env.NEO4J_USERNAME,
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,

  // JWT Configuration
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  TEMP_TOKEN_SECRET: process.env.TEMP_TOKEN_SECRET,

  // Cloudinary Configuration
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  // Qdrant Vector Database Configuration
  QDRANT_URL: process.env.QDRANT_URL || process.env.NEXT_PUBLIC_QDRANT_URL || "http://localhost:6333",
  QDRANT_API_KEY: process.env.QDRANT_API_KEY || process.env.NEXT_PUBLIC_QDRANT_API_KEY,

  // OpenAI Configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  OPENAI_LLM_MODEL: process.env.OPENAI_LLM_MODEL || "gpt-4",

  // Mailtrap Email Configuration
  MAILTRAP_SMTP_HOST: process.env.MAILTRAP_SMTP_HOST,
  MAILTRAP_SMTP_PORT: process.env.MAILTRAP_SMTP_PORT,
  MAILTRAP_SMTP_USER: process.env.MAILTRAP_SMTP_USER,
  MAILTRAP_SMTP_PASS: process.env.MAILTRAP_SMTP_PASS,
  MAILTRAP_SENDEREMAIL: process.env.MAILTRAP_SENDEREMAIL,

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_JWKS_URL: process.env.GOOGLE_JWKS_URL,

  // GitHub OAuth Configuration
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_REDIRECT_URI: process.env.GITHUB_REDIRECT_URI,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_MCP_SERVER_PATH: process.env.GITHUB_MCP_SERVER_PATH,

  // Password Reset Configuration
  FORGOT_PASSWORD_REDIRECT_URL: process.env.FORGOT_PASSWORD_REDIRECT_URL,

  // Application Configuration
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || 10 * 1024 * 1024, // 10MB default
  CHUNK_SIZE: parseInt(process.env.CHUNK_SIZE) || 1000,
  CHUNK_OVERLAP: parseInt(process.env.CHUNK_OVERLAP) || 200,
};

/**
 * Validate required environment variables
 * @throws {Error} If required env variables are missing
 */
export const validateConfig = () => {
  const required = [
    "MONGO_URI",
    "ACCESS_TOKEN_SECRET",
    "REFRESH_TOKEN_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "OPENAI_API_KEY",
  ];

  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

export default config;
