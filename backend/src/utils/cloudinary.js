import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { ErrorCodes } from "./constants.js";
import { ApiError } from "./api-error.js";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
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

