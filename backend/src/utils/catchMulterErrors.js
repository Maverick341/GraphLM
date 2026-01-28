import multer from "multer";
import { ApiError } from "#utils/api-error.js";
import { ErrorCodes } from "#utils/constants.js";

export const catchMulterError = (upload, isAvatarRequired = true) => {
    return (req, res, next) => {
        upload(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                return next(new ApiError(400, `Multer Error: ${err.message}`, {
                    code: ErrorCodes.AVATAR_UPLOAD_FAILED,
                }));
            } else if (err) {
                return next(new ApiError(500, "Unknown upload error", {
                    code: ErrorCodes.AVATAR_UPLOAD_FAILED,
                }));
            }

            if (isAvatarRequired) {
                const hasFile =
                    req.file ||
                    (req.files?.avatar && req.files.avatar.length > 0);

                if (!hasFile) {
                    return next(new ApiError(400, "Avatar file is required", {
                        code: ErrorCodes.AVATAR_NOT_PROVIDED,
                    }));
                }
            }

            next();
        });
    };
};