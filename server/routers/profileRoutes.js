import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getProfile, updateProfile, uploadProfilePhoto, deleteProfilePhoto } from "../controller/profileController.js";
import { uploadImage } from "../middleware/upload.js";

const profileRouter = Router();

profileRouter.get("/",protect,getProfile);   
profileRouter.post("/", protect, uploadImage.none(), updateProfile);
profileRouter.post("/photo", protect, uploadImage.single("photo"), uploadProfilePhoto);
profileRouter.delete("/photo", protect, deleteProfilePhoto);

export default profileRouter;