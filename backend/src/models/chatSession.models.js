import mongoose, { Schema } from "mongoose";

const chatSessionSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sources: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Source",
        required: true,
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
