import mongoose, { Schema } from "mongoose";

const sourceSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },

    sourceType: {
      type: String,
      enum: ["pdf", "github_repo"],
      required: true,
    },

    /**
     * File-based source (PDF)
     * Present only when sourceType === "pdf"
     */
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
      required: function () {
        return this.sourceType === "pdf";
      },
    },

    /**
     * Repo-based source (GitHub)
     * Present only when sourceType === "github_repo"
     */
    repo: {
      type: {
        repoUrl: {
          type: String,
          required: true,
        },
        branch: {
          type: String,
          default: "main",
        },
      },
      required: function () {
        return this.sourceType === "github_repo";
      },
    },

    status: {
      type: String,
      enum: ["uploaded", "indexed", "failed"],
      default: "uploaded",
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Source = mongoose.model("Source", sourceSchema);
