import { Schema, model } from "mongoose";
import { ProjectCampaignModel } from "../../types/Database/types";
import { contentType, projectDurationType } from "../utils/enums";

const projectSchema = new Schema<ProjectCampaignModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    title: { type: String },
    fundingGoal: { type: String },
    description: { type: String },
    duration: { type: String, enum: Object.values(projectDurationType) },
  },
  { timestamps: true }
);

const Project = model<ProjectCampaignModel>("projects", projectSchema);
export default Project;
