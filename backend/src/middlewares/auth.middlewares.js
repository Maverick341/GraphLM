import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ErrorCodes } from "../utils/constants.js";
import { ApiError } from "../utils/api-error.js";

export const isLoggedIn = asyncHandler(async (req, res, next) => {
    console.log(req.cookies);

    const accessToken = req.cookies?.accessToken;
    console.log(accessToken);

    if (!accessToken) {
        throw new ApiError(401, "Unauthorized request", {
            code: ErrorCodes.USER_NOT_LOGGED_IN
        })
    }

    let decodedToken;

    try {
        decodedToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        throw new ApiError(401, "Invalid or expired access token", {
            code: ErrorCodes.INVALID_ACCESS_TOKEN
        });
    }

    if (!decodedToken?._id || typeof decodedToken._id !== "string") {
        throw new ApiError(401, "Malformed token payload", {
            code: ErrorCodes.INVALID_ACCESS_TOKEN
        });
    }

    if (!mongoose.Types.ObjectId.isValid(decodedToken._id)) {
        throw new ApiError(401, "Invalid user ID in token", {
            code: ErrorCodes.INVALID_ACCESS_TOKEN
        });
    }


    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(401, "User not found", {
            code: ErrorCodes.USER_NOT_REGISTERED
        })
    }

    req.user = user;
    next();
});

export const isAdmin = (req, res, next) => {
    if (req.user?.role !== "admin") {
        throw new ApiError(403, "Admin access only", {
            code: ErrorCodes.UNAUTHORIZED_ACCESS
        });
    }
    next();
};


export const validateTempOAuthToken = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies.tempToken;

    let token;

    // Priority 1: Bearer token from Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // Priority 2: HTTP-only cookie fallback
    else if (cookieToken) {
        token = cookieToken;
    }

    if (!token) {
        throw new ApiError(401, 'Temporary token missing for profile completion', {
            code: ErrorCodes.TOKEN_MISSING
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.TEMP_TOKEN_SECRET);
        req.tempUser = decoded; // Attach to req for further use
        next();
    } catch (error) {
        throw new ApiError(401, 'Invalid or expired temporary token', {
            code: ErrorCodes.TOKEN_INVALID
        });
    }
});