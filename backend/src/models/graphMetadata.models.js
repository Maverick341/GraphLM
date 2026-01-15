import mongoose, { Schema } from "mongoose";

const graphMetadataSchema = new Schema({
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true,
    },
    entityCount: {
        type: Number,
        required: true,
    },
    relationCount: {
        type: Number,
        required: true,
    },
    builtAt: {
        type: Date,
        required: true,
    },
});

export const GraphMetadata = mongoose.model('GraphMetadata', graphMetadataSchema);
