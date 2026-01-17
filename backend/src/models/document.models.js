import mongoose, { Schema } from "mongoose";

const documentSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },

    file: {
      type: {
        url: {
          type: String,
          required: true,
        },
        localpath: {
          type: String,
          default: "",
        },
      },
      required: true,
    },

    status: {
      type: String,
      enum: ["uploaded", "indexed", "failed"],
      default: "uploaded",
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const Document = mongoose.model("Document", documentSchema);
