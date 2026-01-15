import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new Schema({
    avatar: {
        type: {
            // url: String,
            // localpath: String
            url: String,
            localpath: {
                type: String,
                default: ""
            }
        },
        default: {
            url: `https://placehold.co/600x400`,
            localpath: ""
        },
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    githubId: {
        type: String,
        unique: true,
        sparse: true,
    },
    username: {
        type: String,
        required: function () {
            return !this.googleId && !this.githubId;
        },
        unique: true,
        lowercase: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullname: {
        type: String,
        required: false,
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId && !this.githubId;
        },
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    forgotPasswordToken: {
        type: String,
    },
    forgotPasswordTokenExpiry: {
        type: Date,
    },
    refreshToken: {
        type: String,
    },
    emailVerificationToken: {
        type: String,
    },
    emailVerificationTokenExpiry: {
        type: Date,
    }
}, { timestamps: true });

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.pre("save", function (next) {
    if (this.isNew) {
        if (this.googleId || this.githubId) {
            this.isEmailVerified = true;
        }
    }
    next();
});


userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
        }
    )
}

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
        }
    )
}

userSchema.methods.generateTemporaryToken = function () {
    const unHashedToken = crypto.randomBytes(20).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(unHashedToken).digest("hex");
    const tokenExpiry = Date.now() + 20 * 60 * 1000;

    return { unHashedToken, hashedToken, tokenExpiry };
}

userSchema.methods.toPublicUserJSON = function () {
    return {
        _id: this._id,
        email: this.email,
        username: this.username,
        isEmailVerified: this.isEmailVerified,
        avatar: this.avatar,
    };
};


export const User = mongoose.model('User', userSchema);