import multer from "multer";
import fs from "fs";
import path from "path";

const baseDir = path.resolve(path.join(__dirname, "../../../src/uploads"));

const ensureDirExists = (subDir: string) => {
  const fullPath = path.join(baseDir, subDir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  return fullPath;
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let subDir = "";

    if (file.mimetype.startsWith("image/")) {
      subDir = "images";
    } else if (file.mimetype.startsWith("audio/")) {
      subDir = "audios";
    } else if (file.mimetype.startsWith("video/")) {
      subDir = "videos";
    } else if (file.fieldname === "invoice" && (
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/msword" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "text/plain" ||
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png"
    )) {
      subDir = "documents";
    } else {
      return cb(
        new Error(
          `Only audio, video, image, and document files are allowed for the ${file.fieldname}`
        ),
        null
      );
    }

    const finalDir = ensureDirExists(subDir);
    cb(null, finalDir);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + "-" + uniqueSuffix + extension);
  },
});

const upload = multer({ storage });
export default upload;
