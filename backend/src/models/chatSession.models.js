import mongoose, { Schema } from "mongoose";

const chatSessionSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        required: true,
    },
});

export const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
