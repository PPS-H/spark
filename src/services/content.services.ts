import { ContentModel } from "../../types/Database/types";
import Content from "../model/content.model";
import ErrorHandler from "../utils/ErrorHandler";

export const getContentById = async (
  contentId: string
): Promise<ContentModel> => {
  const content = await Content.findOne({ _id: contentId, isDeleted: false });
  if (!content) throw new ErrorHandler("Content not found", 400);

  return content;
};
