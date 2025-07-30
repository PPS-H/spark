import { Schema, model } from "mongoose";
import { ContentModel } from "../../types/Database/types";
import { contentType } from "../utils/enums";

const contentSchema = new Schema<ContentModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    title: { type: String },
    file: { type: String },
    genre: { type: String },
    description: { type: String },
    type: { type: String, enum: Object.values(contentType) },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Content = model<ContentModel>("content", contentSchema);
export default Content;
