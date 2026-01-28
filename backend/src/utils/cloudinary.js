import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { ErrorCodes } from "#utils/constants.js";
import { ApiError } from "#utils/api-error.js";
import config from "#config/config.js";

cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    if (!localFilePath) {
        throw new ApiError(400, "Avatar file path can't be null", {
            code: ErrorCodes.AVATAR_FILE_PATH_NOT_FOUND
        })
    }

    try {
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });

        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        if (fs.existsSync(localFilePath)) {
            try {
                fs.unlinkSync(localFilePath);
            } catch (unlinkErr) {
                console.error("Failed to delete file after upload error:", unlinkErr);
            }
        }

        throw new ApiError(500, error.message, {
            code: ErrorCodes.AVATAR_CLOUD_UPLOAD_FAILED
        });
    }
}

export { uploadOnCloudinary }

