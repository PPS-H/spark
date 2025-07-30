import { model, Schema } from "mongoose";
import { likesType } from "../utils/enums";

const likesSchema = new Schema(
  {
    artistId: { type: Schema.Types.ObjectId, ref: "User" },
    contentId: { type: Schema.Types.ObjectId, ref: "content" },
    likedBy: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: Object.values(likesType) },
  },
  {
    timestamps: true,
  }
);

const Likes = model("likes", likesSchema);
export default Likes;
