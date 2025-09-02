import express from "express";
import "dotenv/config";
import morgan from "morgan";
import { connectToDB } from "./src/utils/helper";
import { errorMiddleware } from "./src/middleware/error.middleware";
import router from "./src/router";
import path from "path";
import cors from "cors";  

const app = express();

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5174',
  credentials: true
}));

const uploadsPath = path.join(process.cwd(), "src/uploads");
console.log("Uploads directory path:", uploadsPath);


app.use(morgan("tiny"));
app.use("/uploads", express.static(uploadsPath));


app.use("/api/v1",router)
app.use(errorMiddleware);

app.use(express.static(path.join(__dirname, "../src/public/view")));


connectToDB()
  .then(() => {
    console.log("Connected to DB successfully", process.env.MONGO_URI);
    app.listen(process.env.PORT, () => {
      console.log(`Server is running on port: ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.log("Error connecting to DB", error);
  });
