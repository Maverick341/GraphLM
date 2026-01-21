import mongoose, { Schema } from "mongoose";

const graphMetadataSchema = new Schema({
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Source",
    required: true,
    unique: true,
  },
  entityCount: {
    type: Number,
    default: 0,
  },
  relationCount: {
    type: Number,
    default: 0,
  },
  builtAt: {
    type: Date,
    default: Date.now,
  },
});

export const GraphMetadata = mongoose.model(
  "GraphMetadata",
  graphMetadataSchema,
);
