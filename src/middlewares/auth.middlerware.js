import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import Jwt from "jsonwebtoken";
import { User } from "../models/user.model";

export const verifyJWT = asyncHandler(async(req, res, next) => {
 try {
  const token =  req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer", "")
 
 
  if (!token){
   throw new ApiError(401, "Unauthorized request")
  }
 
  const decodedToken = Jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
 
  const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
 
  if (!user){
   // Dicssion
   throw new ApiError(401, "Invalid Acccess Token")
  }
 
  req.user = user;
  next()  
 } catch (error) {
  throw new ApiError(401, error?.message || "Invalid access token")
 }
})