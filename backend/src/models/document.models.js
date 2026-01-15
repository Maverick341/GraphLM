import mongoose, { Schema } from "mongoose";

const documentSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["uploaded", "indexed", "failed"],
      default: "uploaded",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);


export const Document = mongoose.model('Document', documentSchema);
