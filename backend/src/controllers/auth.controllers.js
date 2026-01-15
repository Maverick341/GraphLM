import crypto from "crypto";
import jwt from "jsonwebtoken";
import axios from "axios";
import { asyncHandler } from "../utils/async-handler.js";
import { User } from "../models/user.models.js";
import {
  sendMail,
  emailVerificationMailGenContent,
  resetPasswordMailGenContent,
} from "../utils/mail.js";
import { ApiError } from "../utils/api-error.js";
import { ErrorCodes } from "../utils/constants.js";
import { ApiResponse } from "../utils/api-response.js";
import {
  generateNonce,
  generateState,
  verifyGoogleToken,
} from "../utils/authUtils.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  //validation
  // registrationValidation(body);

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required", {
      code: ErrorCodes.MISSING_FIELDS,
    });
  }

  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existingUser) {
    throw new ApiError(400, "User with email or username already exists", {
      code: ErrorCodes.USER_ALREADY_EXISTS,
    });
  }

  // const avatarLocalPath = req.files?.avatar[0]?.path;

  // if (!avatarLocalPath) {
  //     throw new ApiError(400, "Avatar file is required", {
  //         code: ErrorCodes.AVATAR_NOT_PROVIDED
  //     })
  // }

  // const avatar = await uploadOnCloudinary(avatarLocalPath);

  const user = await User.create({
    fullname,
    // avatar: {
    //     url: avatar.url
    // },
    username: username.toLowerCase(),
    email,
    password,
  });
  console.log(user);

  if (!user) {
    throw new ApiError(404, "User not registered", {
      code: ErrorCodes.USER_NOT_REGISTERED,
    });
  }

  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();
  console.log(hashedToken);

  user.emailVerificationToken = hashedToken;
  user.emailVerificationTokenExpiry = tokenExpiry;

  await user.save();

  const verificationUrl = `${process.env.BASE_URL}api/v1/users/verifyEmail/${unHashedToken}`;

  await sendMail({
    email: user.email,
    subject: "Verify your email",
    mailGenContent: emailVerificationMailGenContent(
      user.username,
      verificationUrl,
    ),
  });

  const response = new ApiResponse(
    201,
    user.toPublicUserJSON(),
    "User registered successfully. Please verify your email now.",
  );

  return res.status(response.statusCode).json(response);
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "All fields are required", {
      code: ErrorCodes.MISSING_FIELDS,
    });
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(400, "Invalid email or password", {
      code: ErrorCodes.INVALID_CREDENTIALS,
    });
  }

  if (!user.isEmailVerified) {
    throw new ApiError(400, "User not verified", {
      code: ErrorCodes.USER_NOT_VERIFIED,
    });
  }

  const isMatch = await user.comparePassword(password);

  console.log(isMatch);

  if (!isMatch) {
    throw new ApiError(400, "Invalid password", {
      code: ErrorCodes.PASSWORDS_DO_NOT_MATCH,
    });
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;

  await user.save();

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: true,
    maxAge: 3600000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    maxAge: 86400000,
  });

  const response = new ApiResponse(
    201,
    user.toPublicUserJSON(),
    "Login successful",
  );

  return res.status(response.statusCode).json(response);
});

const logoutUser = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    throw new ApiError(401, "Not logged in", {
      code: ErrorCodes.LOGOUT_FAILED,
    });
  }

  const refreshDecoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

  const user = await User.findOne({ _id: refreshDecoded._id });

  if (!user) {
    throw new ApiError(401, "Unauthorized Access", {
      code: ErrorCodes.UNAUTHORIZED_ACCESS,
    });
  }

  user.refreshToken = null;

  res.cookie("accessToken", "", {
    httpOnly: true,
  });

  res.cookie("refreshToken", "", {
    httpOnly: true,
  });

  const response = new ApiResponse(201, undefined, "Logged out successfully");

  return res.status(response.statusCode).json(response);
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;
  console.log(token);

  if (!token) {
    throw new ApiError(400, "Token is missing", {
      code: ErrorCodes.TOKEN_MISSING,
    });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationTokenExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, "Invalid Token", {
      code: ErrorCodes.TOKEN_INVALID,
    });
  }

  if (user.emailVerificationTokenExpiry < Date.now()) {
    throw new ApiError(400, "Token has expired", {
      code: ErrorCodes.TOKEN_EXPIRED,
    });
  }

  if (user.isVerified) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          user.toPublicUserJSON(),
          "Your email is already verified.",
        ),
      );
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationTokenExpiry = undefined;

  await user.save();

  console.log("User is verified");

  const response = new ApiResponse(
    201,
    user.toPublicUserJSON(),
    "User account is verified",
  );

  return res.status(response.statusCode).json(response);
});

const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(
      400,
      "Account not found. Please verify your email or sign in again",
      {
        code: ErrorCodes.USER_NOT_FOUND,
      },
    );
  }

  if (user.isEmailVerified) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isEmailVerified: user.isEmailVerified,
        },
        "Your email is already verified. Please log in",
      ),
    );
  }

  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();
  console.log(hashedToken);

  user.emailVerificationToken = hashedToken;
  user.emailVerificationTokenExpiry = tokenExpiry;

  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${process.env.BASE_URL}api/v1/users/verifyEmail/${unHashedToken}`;

  await sendMail({
    email: user.email,
    subject: "Verify your email",
    mailGenContent: emailVerificationMailGenContent(
      user.username,
      verificationUrl,
    ),
  });

  const response = new ApiResponse(
    201,
    user.toPublicUserJSON(),
    "Verification email sent successfully, check your registered email inbox",
  );

  return res.status(response.statusCode).json(response);
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    throw new ApiError(401, "No refresh token", {
      code: ErrorCodes.REFRESH_TOKEN_MISSING,
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(403, "Invalid or expired refresh token", {
      code: ErrorCodes.REFRESH_TOKEN_INVALID,
    });
  }

  const user = await User.findById(decoded?._id).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found", {
      code: ErrorCodes.USER_NOT_FOUND,
    });
  }

  if (refreshToken !== user?.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or used", {
      code: ErrorCodes.REFRESH_TOKEN_EXPIRED,
    });
  }
  const newAccessToken = await user.generateAccessToken();
  const newRefreshToken = await user.generateRefreshToken();

  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  res.cookie("accessToken", newAccessToken, options);
  res.cookie("refreshToken", newRefreshToken, options);

  const response = new ApiResponse(
    201,
    { newAccessToken, newRefreshToken },
    "Tokens refreshed",
  );

  return res.status(response.statusCode).json(response);
});

const forgotPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, "Invalid Email. No user found", {
      code: ErrorCodes.USER_NOT_FOUND,
    });
  }

  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  user.forgotPasswordToken = hashedToken;
  user.forgotPasswordTokenExpiry = tokenExpiry;

  await user.save();

  const passwordResetUrl = `${process.env.BASE_URL}api/v1/auth/resetPassword/${unHashedToken}`;

  await sendMail({
    email: user.email,
    subject: "Password Reset Link",
    mailGenContent: resetPasswordMailGenContent(
      user.username,
      passwordResetUrl,
    ),
  });

  const response = new ApiResponse(
    201,
    user.toPublicUserJSON(),
    "Reset password email sent. Please check your inbox.",
  );

  return res.status(response.statusCode).json(response);
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  console.log(token);

  const { password, confPassword } = req.body;
  console.log(password);
  console.log(confPassword);

  if (password !== confPassword) {
    console.log("No match");
    throw new ApiError(400, "Passwords do not match", {
      code: ErrorCodes.PASSWORDS_DO_NOT_MATCH,
    });
  }

  if (!token) {
    console.log("Token missing");
    throw new ApiError(400, "Token is missing", {
      code: ErrorCodes.TOKEN_MISSING,
    });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordTokenExpiry: { $gt: Date.now() },
  });

  if (!user) {
    console.log("Token invalid");
    throw new ApiError(400, "Invalid or expired token", {
      code: ErrorCodes.TOKEN_INVALID,
    });
  }

  if (user.forgotPasswordTokenExpiry < Date.now()) {
    console.log("Token expired");
    throw new ApiError(400, "Token has expired", {
      code: ErrorCodes.TOKEN_EXPIRED,
    });
  }

  console.log("Password Changed");

  user.password = password;
  user.forgotPasswordToken = undefined;
  user.forgotPasswordTokenExpiry = undefined;

  console.log("Password Changed");

  await user.save();
  console.log("Password Changed");

  const response = new ApiResponse(
    201,
    user.toPublicUserJSON(),
    "Password changed successfully",
  );

  return res.status(response.statusCode).json(response);
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const targetUserId = req.params.userId || req.user._id;

  if (req.params.userId && req.user.role !== "admin") {
    throw new ApiError(403, "Forbidden: You cannot view this user's data", {
      code: ErrorCodes.UNAUTHORIZED_ACCESS,
    });
  }

  const user = await User.findById(targetUserId).select(
    "-password -refreshToken -__v",
  );
  console.log(user);

  if (!user) {
    throw new ApiError(400, "User not found", {
      code: ErrorCodes.USER_NOT_FOUND,
    });
  }

  const response = new ApiResponse(
    201,
    user.toPublicUserJSON(),
    "Current User Shown",
  );

  return res.status(response.statusCode).json(response);
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { username, fullname } = req.body;

  const targetUserId = req.params.userId || req.user._id;

  if (!username || !fullname) {
    throw new ApiError(400, "All fields are required", {
      code: ErrorCodes.MISSING_FIELDS,
    });
  }

  if (req.params.userId && req.user.role !== "admin") {
    throw new ApiError(403, "Forbidden: Not authorized to update this user", {
      code: ErrorCodes.UNAUTHORIZED_ACCESS,
    });
  }

  const updates = {};

  if (username) {
    const existingUser = await User.findOne({
      username,
      _id: { $ne: targetUserId },
    });
    if (existingUser) {
      throw new ApiError(400, "User with email or username already exists", {
        code: ErrorCodes.USER_ALREADY_EXISTS,
      });
    }
    updates.username = username;
  }

  if (fullname) {
    updates.fullname = fullname;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "At least one field must be provided", {
      code: ErrorCodes.MISSING_FIELDS,
    });
  }

  const updatedUser = await User.findByIdAndUpdate(
    targetUserId,
    {
      $set: { username, fullname },
    },
    {
      new: true,
      runValidators: true,
    },
  ).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedUser.toPublicUserJSON(),
        "Account details updated successfully",
      ),
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing", {
      code: ErrorCodes.AVATAR_FILE_PATH_NOT_FOUND,
    });
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: {
          url: avatar.url,
        },
      },
    },
    { new: true },
  ).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user.toPublicUserJSON(),
        "Avatar image updated successfully",
      ),
    );
});

const googleLogin = asyncHandler(async (req, res) => {
  console.log("Google Login triggered");

  const token = req.cookies.accessToken;
  if (token) {
    throw new ApiError(
      409,
      "You're already logged in. Logout before logging in again",
      {
        code: ErrorCodes.ALREADY_LOGGED_IN,
      },
    );
  }

  const state = generateState();
  const nonce = generateNonce();

  // Store state and nonce in session cookies
  res.cookie("oauth_state", state, {
    httpOnly: true,
    maxAge: 600000,
    sameSite: "lax",
  });
  res.cookie("oauth_nonce", nonce, {
    httpOnly: true,
    maxAge: 600000,
    sameSite: "lax",
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=email%20profile%20openid&state=${state}&nonce=${nonce}`;

  res.redirect(googleAuthUrl);
});

const googleCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const savedState = req.cookies.oauth_state;
  const savedNonce = req.cookies.oauth_nonce;

  res.clearCookie("oauth_state");
  res.clearCookie("oauth_nonce");

  if (!state || !savedState || state !== savedState) {
    throw new ApiError(401, "Invalid state parameter", {
      code: ErrorCodes.INVALID_OAUTH_STATE,
    });
  }

  // Exchange code for Google tokens
  const tokenResponse = await axios.post(
    "https://oauth2.googleapis.com/token",
    null,
    {
      params: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        code,
        grant_type: "authorization_code",
      },
    },
  );

  const { id_token, googleAccessToken, googleRefreshToken } =
    tokenResponse.data;
  if (!id_token) {
    throw new ApiError(400, "Missing ID token from Google", {
      code: ErrorCodes.MISSING_ID_TOKEN,
    });
  }

  const decodedToken = await verifyGoogleToken(id_token);
  if (!decodedToken) {
    throw new ApiError(401, "Invalid ID token", {
      code: ErrorCodes.INVALID_ID_TOKEN,
    });
  }

  if (!decodedToken.nonce || decodedToken.nonce !== savedNonce) {
    throw new ApiError(401, "Invalid nonce parameter", {
      code: ErrorCodes.INVALID_NONCE,
    });
  }

  const googleProfilePic = decodedToken.picture.replace(/=s\d+-c$/, "=s256-c");

  let user = await User.findOne({ email: decodedToken.email });
  if (!user) {
    const tempToken = jwt.sign(
      {
        googleId: decodedToken.sub,
        email: decodedToken.email,
        name: decodedToken.name,
        url: googleProfilePic,
        googleRefreshToken: googleRefreshToken || null,
      },
      process.env.TEMP_TOKEN_SECRET,
      { expiresIn: "5m" },
    );

    res.cookie("tempToken", tempToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 5 * 60 * 1000, // 5 min
    });

    return res.redirect(`${process.env.CLIENT_URL}/complete-profile`);

    // return res.redirect(`${process.env.CLIENT_URL}/complete-profile?token=${tempToken}`);
  } else {
    let modified = false;

    if (!user.googleId) {
      user.googleId = decodedToken.sub;
      modified = true;
    }

    if (googleRefreshToken && user.refreshToken !== googleRefreshToken) {
      user.refreshToken = googleRefreshToken;
      modified = true;
    }

    if (modified) {
      await user.save();
    }

    // Generate our own JWT access and refresh tokens for the user
    const accessToken = jwt.sign(
      { _id: user._id, email: user.email },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
      },
    );

    const refreshToken = jwt.sign(
      { _id: user._id, email: user.email },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
      },
    );

    // Set the JWT tokens in a cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600000, // 1 hour
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400000, // 24 hour
    });

    const response = new ApiResponse(
      201,
      user.toPublicUserJSON(),
      "Google Login successful",
    );

    return res.status(response.statusCode).json(response);
  }
});

const completeGoogleSignup = asyncHandler(async (req, res) => {
  const { username } = req.body;
  const { email, googleId, name, url, googleRefreshToken } = req.tempUser;

  res.clearCookie("tempToken");

  const existing = await User.findOne({ username });
  if (existing)
    throw new ApiError(409, "Username already taken", {
      code: ErrorCodes.USER_ALREADY_EXISTS,
    });

  const user = await User.create({
    username,
    email,
    googleId,
    name,
    avatar: {
      url: url,
      localpath: "",
    },
    refreshToken: googleRefreshToken || null,
  });

  const accessToken = jwt.sign(
    { _id: user._id, email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
  );

  const refreshToken = jwt.sign(
    { _id: user._id, email: user.email },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY },
  );

  res.cookie("accessToken", accessToken, { httpOnly: true, maxAge: 3600000 });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    maxAge: 86400000,
  });

  return res
    .status(201)
    .json({ message: "Signup completed", user: user.toPublicUserJSON() });
});

const githubLogin = asyncHandler(async (req, res) => {
  console.log("Github Login triggered");
  const token = req.cookies.accessToken;
  if (token) {
    throw new ApiError(
      401,
      "Already logged in. Logout before logging in again",
      {
        code: ErrorCodes.OAUTH_LOGIN_FAILED,
      },
    );
  }

  const state = generateState();
  res.cookie("oauth_state", state, {
    httpOnly: true,
    maxAge: 600000,
    sameSite: "lax",
  });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT_URI}&scope=user:email&state=${state}`;

  res.redirect(githubAuthUrl);
});

const githubCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const savedState = req.cookies.oauth_state;
  res.clearCookie("oauth_state");

  if (!state || !savedState || state !== savedState) {
    throw new ApiError(401, "Invalid state parameter", {
      code: ErrorCodes.INVALID_OAUTH_STATE,
    });
  }

  // Exchange code for access token
  const tokenResponse = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    },
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  const githubAccessToken = tokenResponse.data.access_token;
  if (!githubAccessToken) {
    throw new ApiError(401, "No access token received from GitHub", {
      code: ErrorCodes.OAUTH_NO_ACCESS_TOKEN,
    });
  }

  // Get user info from GitHub
  const userInfo = await axios.get("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${githubAccessToken}`,
    },
  });

  const { id, login, email, name, avatar_url } = userInfo.data;

  const userProfilePic =
    avatar_url || `https://github.com/identicons/${login}.png`;

  // GitHub sometimes doesn't return email, so you might need a second call:
  let userEmail = email;
  if (!userEmail) {
    const emails = await axios.get("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
      },
    });
    const primaryEmail = emails.data.find((e) => e.primary && e.verified);
    userEmail = primaryEmail?.email || `${login}@github.com`;
  }

  // Find or create user
  let user = await User.findOne({ email: userEmail });
  if (!user) {
    let githubUsername = login;
    const existingUser = await User.findOne({ username: login });

    if (existingUser) {
      const randomSuffix = crypto.randomUUID().slice(0, 5);
      githubUsername = `${login}-${randomSuffix}`;
    }

    user = await User.create({
      githubId: id,
      username: githubUsername,
      email: userEmail,
      name: name || login,
      avatar: {
        url: userProfilePic,
        localpath: "",
      },
    });
  } else {
    if (!user.githubId) {
      user.githubId = id;
    }

    if (!user.username) {
      const existingUser = await User.findOne({ username: login });
      user.username = existingUser
        ? `${login}-${crypto.randomUUID().slice(0, 5)}`
        : login;
    }

    await user.save();
  }

  // Generate JWT
  const accessToken = jwt.sign(
    { _id: user._id, email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
  );

  const refreshToken = jwt.sign(
    { _id: user._id, email: user.email },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    },
  );

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600000,
  });

  return res
    .status(201)
    .json(
      new ApiResponse(201, user.toPublicUserJSON(), "GitHub Login successful"),
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  verifyEmail,
  resendVerificationEmail,
  refreshAccessToken,
  forgotPasswordRequest,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  googleLogin,
  googleCallback,
  completeGoogleSignup,
  githubLogin,
  githubCallback,
};
