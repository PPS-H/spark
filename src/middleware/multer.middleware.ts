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
    } else {
      return cb(
        new Error(
          `Only audio, video, and image files are allowed for the ${file.fieldname}`
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
