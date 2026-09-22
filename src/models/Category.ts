import { Schema, model, models, InferSchemaType } from "mongoose";

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    sortOrder: { type: Number, required: true, default: 0, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type CategoryDoc = InferSchemaType<typeof CategorySchema>;

export const Category = models.Category || model("Category", CategorySchema);