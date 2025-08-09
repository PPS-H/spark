import { model, Schema } from "mongoose";

const searchHistorySchema = new Schema(
  {
    userId: { type: String, required: true },
    searchTerm: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

searchHistorySchema.index({ searchTerm: 1 });

const SearchHistory = model("searchHistory", searchHistorySchema);
export default SearchHistory;
