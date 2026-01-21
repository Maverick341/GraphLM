import mongoose, { Schema } from "mongoose";

const vectorIndexMetadataSchema = new Schema({
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Source",
    required: true,
    unique: true,
  },
  provider: {
    type: String,
    required: true,
  },
  collectionName: {
    type: String,
    required: true,
  },
  indexedAt: {
    type: Date,
    default: Date.now,
  },
});

export const VectorIndexMetadata = mongoose.model(
  "VectorIndexMetadata",
  vectorIndexMetadataSchema,
);
