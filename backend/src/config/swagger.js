export default {
  openapi: "3.1.0",
  info: {
    title: "Authentication API",
    version: "1.0.0",
    description: "API documentation for auth routes (local and OAuth)",
  },
  servers: [
    {
      url: "http://localhost:4000/api/v1",
      description: "Local dev server",
    },
  ],
  tags: [
    {
      name: "Local Auth",
      description: "Email/password-based authentication routes",
    },
    {
      name: "OAuth",
      description: "OAuth2-based social login routes (Google, GitHub)",
    },
  ],
  paths: {
    "/auth/register": {
      post: {
        tags: ["Local Auth"],
        summary: "Register a new user with avatar",
        description: "Registers a user with fullname, email, username, password, and optional avatar upload.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  fullname: { type: "string" },
                  email: { type: "string", format: "email" },
                  username: { type: "string" },
                  password: { type: "string", format: "password" },
                  avatar: {
                    type: "string",
                    format: "binary",
                  },
                },
                required: ["fullname", "email", "username", "password"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "User registered successfully",
          },
          "400": {
            description: "Validation failed or avatar error",
          },
        },
      },
    },
    "/auth/verifyEmail/{token}": {
      get: {
        tags: ["Local Auth"],
        summary: "Verifies the user's email address using a token sent via email.",
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            description: "Email verification token",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Email verified successfully" },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/auth/resendVerifyEmail": {
      post: {
        tags: ["Local Auth"],
        summary: "Resend verification email",
        description: "Sends a new verification email to the user's email address.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                  },
                },
                required: ["email"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Verification email resent",
          },
          "400": {
            description: "Invalid or already verified email",
          },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Local Auth"],
        summary: "Login with email and password",
        description: "Authenticates user with email and password, returns access and refresh tokens via cookies.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                  },
                  password: {
                    type: "string",
                    format: "password",
                  },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
          },
          "401": {
            description: "Invalid credentials",
          },
        },
      },
    },
    "/auth/refreshAccessToken": {
      get: {
        tags: ["Local Auth"],
        summary: "Refresh access token",
        description: "Generates a new access token using the refresh token stored in cookies.",
        security: [
          {
            cookieAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "Access token refreshed successfully",
          },
          "401": {
            description: "Missing or invalid refresh token",
          },
        },
      },
    },
    "/auth/profile": {
      get: {
        tags: ["Local Auth"],
        summary: "Get current user profile",
        description: "Returns profile details of the currently logged-in user.",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "User profile returned" },
          "401": { description: "Unauthorized or invalid session" },
        },
      },
    },
    "/auth/logout": {
      get: {
        tags: ["Local Auth"],
        summary: "Logout user",
        description: "Logs out the user by clearing access and refresh tokens from cookies.",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "User logged out successfully",
          },
          "401": {
            description: "User not authenticated",
          },
        },
      },
    },
    "/auth/forgotPassword": {
      post: {
        tags: ["Local Auth"],
        summary: "Request password reset",
        description: "Sends a password reset email to the user with a reset link.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                  },
                },
                required: ["email"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Reset link sent to email",
          },
          "400": {
            description: "Email not found or not verified",
          },
        },
      },
    },
    "/auth/resetPassword/{token}": {
      post: {
        tags: ["Local Auth"],
        summary: "Reset password with token",
        description: "Allows the user to reset their password using a token sent via email.",
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            description: "Password reset token",
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  newPassword: {
                    type: "string",
                    format: "password",
                  },
                  confirmPassword: {
                    type: "string",
                    format: "password",
                  },
                },
                required: ["newPassword", "confirmPassword"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Password reset successful",
          },
          "400": {
            description: "Invalid token or mismatched passwords",
          },
        },
      },
    },
    "/auth/updateProfile": {
      post: {
        tags: ["Local Auth"],
        summary: "Update user profile",
        description: "Updates the current user's profile details like username and fullname.",
        security: [
          {
            cookieAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: {
                    type: "string",
                  },
                  fullname: {
                    type: "string",
                  },
                },
                required: ["username", "fullname"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Profile updated successfully",
          },
          "400": {
            description: "Invalid input or validation error",
          },
        },
      },
    },
    "/auth/updateAvatar": {
      patch: {
        tags: ["Local Auth"],
        summary: "Update user avatar",
        description: "Uploads and updates the user's avatar image.",
        security: [
          {
            cookieAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  avatar: {
                    type: "string",
                    format: "binary",
                  },
                },
                required: ["avatar"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Avatar updated successfully",
          },
          "400": {
            description: "Invalid image or upload failed",
          },
        },
      },
    },
    "/auth/google": {
      get: {
        tags: ["OAuth"],
        summary: "Start Google OAuth login",
        description: "Redirects the user to Google's OAuth 2.0 login page. This flow cannot be tested from Swagger UI.",
        responses: {
          "302": { description: "Redirect to Google OAuth 2.0" },
        },
      },
    },
    "/auth/google/callback": {
      get: {
        tags: ["OAuth"],
        summary: "Google OAuth callback",
        description: "Handles the callback after Google OAuth login. Processes the `code` and `state` query params and validates against stored cookies.",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: {
              type: "string",
            },
            description: "OAuth authorization code from Google",
          },
          {
            name: "state",
            in: "query",
            required: true,
            schema: {
              type: "string",
            },
            description: "State parameter for CSRF protection",
          },
        ],
        responses: {
          "200": {
            description: "Google login success or failure",
          },
          "400": {
            description: "Invalid state or code",
          },
        },
      },
    },
    "/auth/set-google-oauth-username": {
      post: {
        tags: ["OAuth"],
        summary: "Set username for Google OAuth users",
        description: "Sets a unique username after Google OAuth login. Uses temporary user data stored via middleware.",
        security: [
          {
            cookieAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: {
                    type: "string",
                  },
                },
                required: ["username"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Username set successfully",
          },
          "400": {
            description: "Validation failed or user already exists",
          },
        },
      },
    },
    "/auth/github": {
      get: {
        tags: ["OAuth"],
        summary: "Start GitHub OAuth",
        description: "Redirects the user to Githubs's OAuth 2.0 login page. This flow cannot be tested from Swagger UI.",
        responses: {
          "302": { description: "Redirect to GitHub" },
        },
      },
    },
    "/auth/github/callback": {
      get: {
        tags: ["OAuth"],
        summary: "GitHub OAuth callback",
        description: "Handles GitHub OAuth callback. Processes `code` and `state` from query and matches with saved state in cookies.",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: {
              type: "string",
            },
            description: "OAuth authorization code from GitHub",
          },
          {
            name: "state",
            in: "query",
            required: true,
            schema: {
              type: "string",
            },
            description: "State parameter for CSRF protection",
          },
        ],
        responses: {
          "200": {
            description: "GitHub login success or failure",
          },
          "400": {
            description: "Invalid state or code",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "accessToken",
      },
    },
  },
};
