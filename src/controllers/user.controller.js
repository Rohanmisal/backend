import {asyncHandler} from "../utils/asyncHandler.js";
import { ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOncloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt, { decode } from "jsonwebtoken"
import mongoose from "mongoose";

const generateAccessAndRefereshTokens = async(userId) => {
  try{
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken= refreshToken
    await user.save({validateBeforeSave: false})

    return {accessToken, refreshToken}

  } catch (error){
    console.error("Original error details:", error);
    throw new ApiError(500, "Something went wrong while generating referesh and access token")
  }
}
const registerUser = asyncHandler(async (req ,res) => {
 // get user details from frontend
 // validation - email, username , not empty
 // check if user already exists: username, email
 // check for images, check for avatar
 //upload them to cloudinary
 //create user object- create entry in db
 // remove password and refresh token field from response
 // check for user creation 
 // return res


 const {fullname, email, username, password} = req.body
  console.log("email:", email);
  console.log("fullName:", fullname);

  // if (fullName === "" ){
  //   throw new ApiError(400, "fullname is required")
  // }

  if(
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ){
    throw new ApiError(400, "All fields are required")
  }
  const existedUSer = await User.findOne({
    $or: [{ username }, { email }]
  })

  if (existedUSer){
    throw new ApiError(409, "User with email or username already exist")
  }
  console.log(req.files);
  const avatarLocalPath= req.files?.avatar[0]?.path; 
  // const coverImageLocalPath= req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0 ){
    coverImageLocalPath = req.files.coverImage[0].path
  }

  if (!avatarLocalPath){
    throw new ApiError(400, "Avatar file is required")
  }
  
  const avatar = await uploadOncloudinary(avatarLocalPath)
  const coverImage= await uploadOncloudinary(coverImageLocalPath)

  if (!avatar){
    throw new ApiError(400, "Avatar file is required")
  }

  const user = await User.create(
    {
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase()
    })
    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    )
    if (!createdUser){
      throw new ApiError(500, "Someting went wrong while registering rhe user")
    }

    return res.status(201).json(
      new ApiResponse(200, createdUser, "User register Successfully")
    )
})

const loginUser = asyncHandler(async(req, res) => {
  // to get data from req body
  // username or email
  //find the user
  // check the password
  // access and refresh token
  // send cookie
  // response -> successfully login

  const {email, username, password} = req.body

  if (!(username || email)){
    throw new ApiError(400, "username or email is required")
  }
  // Alternate for above code
  // if (!username && !email){
  //   throw new ApiError(400, "username or email is required")
  // }

  const user = await User.findOne({
    $or:[{username}, {email}]
  })

  if (!user){
    throw new ApiError(404, "User does not exist")
  }
  const isPasswordvalid = await user.isPasswordCorrect(password)

  if (!isPasswordvalid) {
    throw new ApiError(401, "Invalid user credentials")
  }

  const {accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  }

  return res.status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser, accessToken,
        refreshToken
      },
      "User logged In Successfully"
    )
  )
})

const logoutUser = asyncHandler(async(req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {} , "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) =>{
 const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

 if (!incomingRefreshToken) {
  throw new ApiError(401, "unauthorized request")
 }

 try {
  const decodedToken = jwt.verify(
   incomingRefreshToken, 
   process.env.REFRESH_TOKEN_SECRET
  )
 
  const user = await User.findById(decodedToken?._id)
 
  if(!user){
   throw new ApiError(401, "Invalid refresh token")
  }
 
  if(incomingRefreshToken !== user?.refreshToken){
   throw new ApiError(401, "RefreshToken token is expired or used")
  }
 
  const options = {
   httpOnly: true,
   secure: true
  }
 
 const {accessToken, newrefreshToken}=  await generateAccessAndRefereshTokens(user._id)
 
  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", newrefreshToken, options)
  .json(
   new ApiResponse(
     200,
     {accessToken, refreshToken: newrefreshToken},
     "Access token refreshed"
 
   )
  )
 } catch (error) {
   throw new ApiError(401,error?.message || "Invalid refresh token")
 }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
  const {oldPassword, newPassword, confirmPassword} = req.body

  if (!oldPassword ||!newPassword ||!confirmPassword) {
    throw new ApiError(400, "All fields are required")
  }

  if (newPassword!== confirmPassword) {
    throw new ApiError(400, "Passwords do not match")
  }

  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid old password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave: false})

  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Password changed successfully"
    )
  )

})

const getCurrentUser = asyncHandler(async(req, res) => {
  return res
  .status(200)
  .json(new ApiResponse(200,req.user, "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
  const { fullname, email} = req.body

  if (!fullname ||!email) {
    throw new ApiError(400, "All fields are required")
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        fullname,
        email
      }
    },
    {
      new: true
    }
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res) =>
{
  const avatarLocalPath = req.file?.path

  if (!avatarLocalPath){
    throw new ApiError(400, "Avatar file is missing")
  }
  // Todo delete old image
  const avatar = await uploadOncloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400, "Error while uploading on avatar ")
  }

 const user= await User.findByIdAndUpdate(
  req.user?._id,
  {
    $set:{
      avatar: avatar.url
    }
  },
  {new: true}
 ).select("-password")
 return res
 .status(200)
 .json(
  new ApiResponse(200, user, "avatar image updated successfully")
 )
})


const updateUserCoverImage = asyncHandler(async(req,res) =>
{
  const coverImageLocalPath = req.file?.path

  if (!coverImageLocalPath){
    throw new ApiError(400, "coverImage file is missing")
  }

  const coverImage = await uploadOncloudinary(coverImageLocalPath)

  if(!coverImage.url){
    throw new ApiError(400, "Error while uploading on avatar ")
  }

 const user = await User.findByIdAndUpdate(
  req.user?._id,
  {
    $set:{
      coverImage: coverImage.url
    }
  },
  {new: true}
 ).select("-password")

 return res
 .status(200)
 .json(
  new ApiResponse(200, user, "cover image updated successfully")
 )
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
  const {username} = req.params

  if (!username?.trim()){
    throw new ApiError(400, "username is missing")
  }

  const channel = User.aggregate([
    {
      $match:{
        username: username?.toLowerCase()
      }
    },
    {
      $lookup:{
        from: "subscription",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers" 
      }
    },
    {
      $lookup:{
        from: "subscription",
        localField:"_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      } 
    },
    {
      $addFields:{
        subscribersCount:{
          $size: "$subscribers"
        },
        channelsSubscribedToCount:{
          $size: "$subscribedTo"
        },
        isSubscribed: {
          $cond:{
            if:{$in: [req.user?._id, "$subscribers.subscriber"]},
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project:{
        fullname:1,
        username:1,
        subscribersCount:1,
        channelsSubscribedToCount:1,
        isSubscribed:1,
        avatar:1,
        coverImage:1,
        email:1,
      }
    }
  ])
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile
}