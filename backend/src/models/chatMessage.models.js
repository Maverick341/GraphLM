import mongoose, { Schema } from "mongoose";

const chatMessageSchema = new Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatSession",
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
