import mongoose from "mongoose";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import Stripe from "stripe";


export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


export const connectToDB = () => mongoose.connect(process.env.MONGO_URI);

export const TryCatch =
  (func: any) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(func(req, res, next)).catch(next);

export const generateJwtToken = (payload: any) => {
  return jwt.sign(payload, process.env.JWT_SECRET);
};

export const generateRandomString = (length: number): string => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(){}[]:;<>+=?/|";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

export const generateOTP = () =>
  otpGenerator.generate(4, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

export const addMinutesToCurrentTime = (minutes: number) => {
  return new Date().getTime() + minutes * 60000;
};

export const getFiles = (req: Request, fileNames: Array<string>) => {
  // Single file uploaded
  // if (fileNames.length == 1 && req.file) {
  //   return {
  //     [fileNames[0]]: process.env.BACKEND_URL + "/uploads/" + req.file.filename,
  //   };
  // }

  // Multiple files uploaded
  const files: any = {};
  fileNames.forEach((fileKey: string) => {
    if (req.files && req.files[fileKey]) {
      files[fileKey] = req.files[fileKey].map((file: any) => {
        let subDir = "";
        if (file.mimetype.startsWith("image/")) {
          subDir = "images/";
        } else if (file.mimetype.startsWith("audio/")) {
          subDir = "audios/";
        } else if (file.mimetype.startsWith("video/")) {
          subDir = "videos/";
        }
        return "uploads/" + subDir + file.filename;
      });
    }
  });
  if (Object.keys(files).length) return files;

  return null;
};

type ResponseData = Record<string, any>;

export const SUCCESS = (
  res: Response,
  status: number,
  message: string,
  data?: ResponseData
): ResponseData => {
  return res.status(status).json({
    success: true,
    message,
    ...(data ? data : {}),
  });
};
