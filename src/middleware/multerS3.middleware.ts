import { S3Client } from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";

export const s3 = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const uploadS3 = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    metadata: function (req, file, cb) {
      const isImage = req.files["profileImage"] || req.files["photos"];

      if (
        isImage &&
        !file.mimetype.includes("image") &&
        !file.mimetype.includes("octet-stream")
      ) {
        return cb(
          new Error(`Only image is allowed for the ${file.fieldname}`),
          null
        );
      }

      try {
        cb(null, { fieldName: file.fieldname });
      } catch (error) {
        console.log(error);
      }
    },
    key: function (req, file, cb) {
      const { userId } = req;
      const isImage = req.files["profileImage"] || req.files["photos"];

      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname).toLowerCase();
      const fileName = file.fieldname + "-" + uniqueSuffix + extension;
      const imageDir = `uploads/users/${fileName}`;
      const chatDir = `uploads/chats/user-${userId}/${fileName}`;
      console.log("fileName::", fileName, imageDir, chatDir);

      try {
        if (isImage) {
          cb(null, imageDir);
        } else {
            cb(null, chatDir);
        }
      } catch (error) {
        console.log("error::", error);
      }
    },
  }),
});

export default uploadS3;
