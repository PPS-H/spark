import { model, Schema } from "mongoose";

const followUnfollowSchema = new Schema(
  {
    artistId: { type: Schema.Types.ObjectId, ref: "User" },
    followedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

const FollowUnfollow = model("followUnfollow", followUnfollowSchema);
export default FollowUnfollow;
