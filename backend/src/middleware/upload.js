import fs from "fs";
import path from "path";
import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const allowedExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".dwg",
  ".dxf",
  ".step",
  ".stp",
]);

const storage = multer.diskStorage({
  destination(req, _file, callback) {
    const moduleName = String(req.params.moduleName || "common")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");

    const target = path.resolve(env.uploadRoot, "marketing", moduleName);
    fs.mkdirSync(target, { recursive: true });
    callback(null, target);
  },

  filename(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);

    callback(
      null,
      `${Date.now()}_${Math.round(Math.random() * 1e9)}_${baseName}${extension}`
    );
  },
});

function fileFilter(_req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(extension)) {
    return callback(
      new Error("Unsupported file type. Upload PDF, Office, image, DWG, DXF or STEP files.")
    );
  }

  callback(null, true);
}

export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024,
  },
}).single("file");

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension !== ".xlsx") {
      return callback(new AppError("Upload the Item Master template as an .xlsx file."));
    }
    callback(null, true);
  },
  limits: {
    fileSize: Math.min(env.maxUploadMb, 10) * 1024 * 1024,
  },
}).single("file");

export const uploadPdf = multer({
  storage,
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension !== ".pdf" || (file.mimetype && file.mimetype !== "application/pdf")) {
      return callback(new Error("Only PDF quotation documents can be uploaded."));
    }
    callback(null, true);
  },
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024,
  },
}).single("file");

const gaugeCertificateStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    const target = path.resolve(env.uploadRoot, "gauges", "calibration-certificates");
    fs.mkdirSync(target, { recursive: true });
    callback(null, target);
  },
  filename(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);
    callback(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}_${baseName}${extension}`);
  },
});

export const uploadGaugeCertificate = multer({
  storage: gaugeCertificateStorage,
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension !== ".pdf" || (file.mimetype && file.mimetype !== "application/pdf")) {
      return callback(new AppError("Only PDF calibration certificates can be uploaded.", 400));
    }
    callback(null, true);
  },
  limits: {
    fileSize: Math.min(env.maxUploadMb, 10) * 1024 * 1024,
  },
}).single("certificate");
