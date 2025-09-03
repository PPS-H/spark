import Payment from "../model/payment.model";
import Project from "../model/projectCampaign.model";
import { paymentStatus } from "../utils/enums";

export const getUserTotalFundsRaised=async(artistIds:any[])=>{
    const fundingData = await Project.aggregate([
        {
          $match: {
            userId: { $in: artistIds },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: "$userId", // Group by artist ID
            totalFundingGoal: { $sum: "$fundingGoal" },
            projectIds: { $push: "$_id" }
          }
        }
      ]);

      return fundingData;
}

export const getUserTotalPayments=async(artistIds:any[])=>{
    const paymentData = await Payment.aggregate([
        {
          $lookup: {
            from: "projects",
            localField: "projectId",
            foreignField: "_id",
            as: "project"
          }
        },
        {
          $unwind: "$project"
        },
        {
          $match: {
            "project.userId": { $in: artistIds },
            status: paymentStatus.SUCCESS
          }
        },
        {
          $group: {
            _id: "$project.userId", // Group by artist ID
            totalRaised: { $sum: "$amount" },
            averageExpectedReturn: { $avg: "$expectedReturn" }
          }
        }
      ]);
    

      return paymentData;
}