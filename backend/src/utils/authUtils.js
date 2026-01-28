import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import crypto from "crypto";
import dotenv from "dotenv";
import { ApiError } from "#utils/api-error.js";
import { ErrorCodes } from "#utils/constants.js";
import config from "#config/config.js";

dotenv.config({
    path: "./.env"
})

const generateState = () => {
    return crypto.randomBytes(32).toString("hex");
};

const generateNonce = () => {
    return crypto.randomBytes(32).toString("hex");
};

const getJwksClient = () => {
    return jwksClient({
        jwksUri: config.GOOGLE_JWKS_URL,
        cache: true,
        rateLimit: true,
    });
};

const getSigningKey = async (kid) => {
    const client = getJwksClient();

    return new Promise((resolve, reject) => {
        client.getSigningKey(kid, (err, key) => {
            if (err) {
                console.error("Error getting signing key: ", err);
                return reject(err);
            }
            const signingkey = key.getPublicKey();
            resolve(signingkey);
        });
    });
}

const verifyGoogleToken = async (token) => {
    try {
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded) {
            throw new ApiError(400, "Invalid id Token", {
                code: ErrorCodes.INVALID_ID_TOKEN
            });
        }

        const kid = decoded.header.kid;
        const signingKey = await getSigningKey(kid);

        const verifiedToken = jwt.verify(token, signingKey, {
            algorithms: ["RS256"],
            audience: config.GOOGLE_CLIENT_ID,
        });
        return verifiedToken;
    } catch (error) {
        console.log("Error verifying token:", error);
        throw new ApiError(400, "Token verification failed", {
            code: ErrorCodes.UNKNOWN_ERROR
        });
    }
};

export { generateNonce, generateState, verifyGoogleToken };