import { Router } from "express";

import {
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
} from "#controllers/auth.controllers.js";

import { validate } from "#middlewares/validator.middlewares.js";
import {
  userLoginValidator,
  updateUserValidator,
  cookieBasedTokenValidator,
  userRegistrationValidator,
  verifyEmailValidator,
  emailOnlyValidator,
  userIdValidator,
  resetPasswordValidator,
} from "#validators/index.js";
import {
  isAdmin,
  isLoggedIn,
  validateTempOAuthToken,
} from "#middlewares/auth.middlewares.js";
import { upload } from "#middlewares/multer.middlewares.js";
import { catchMulterError } from "#utils/catchMulterErrors.js";

const router = Router();

router.route("/register").post(
  // catchMulterError(
  //     upload.fields([{ name: "avatar", maxCount: 1 }]),
  //     false
  // ),
  userRegistrationValidator(),
  validate,
  registerUser,
);
router
  .route("/verifyEmail/:token")
  .get(verifyEmailValidator(), validate, verifyEmail);
router
  .route("/resendVerifyEmail")
  .post(emailOnlyValidator(), validate, resendVerificationEmail);
router.route("/login").post(userLoginValidator(), validate, loginUser);
router
  .route("/refreshAccessToken")
  .get(cookieBasedTokenValidator(), validate, isLoggedIn, refreshAccessToken);
router.route("/profile").get(isLoggedIn, getCurrentUser);
router
  .route("/logout")
  .get(cookieBasedTokenValidator(), validate, isLoggedIn, logoutUser);
router
  .route("/forgotPassword")
  .post(emailOnlyValidator(), validate, forgotPasswordRequest);
router
  .route("/resetPassword/:token")
  .post(resetPasswordValidator(), validate, changeCurrentPassword);
router
  .route("/updateProfile")
  .post(updateUserValidator(), validate, isLoggedIn, updateAccountDetails);

router
  .route("/updateAvatar")
  .patch(
    isLoggedIn,
    catchMulterError(upload.single("avatar")),
    updateUserAvatar,
  );

router.route("/google").get(googleLogin);
router.route("/google/callback").get(googleCallback);
router
  .route("/google/completeOAuth")
  .post(validateTempOAuthToken, completeGoogleSignup);
router.route("/github").get(githubLogin);
router.route("/github/callback").get(githubCallback);

router
  .route("/:userId")
  .get(userIdValidator(), isLoggedIn, isAdmin, validate, getCurrentUser)
  .patch(
    [userIdValidator(), updateUserValidator()],
    isLoggedIn,
    isAdmin,
    validate,
    updateAccountDetails,
  );

export default router;
