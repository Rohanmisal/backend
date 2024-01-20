import {asyncHandler} from "../utils/asyncHandler.js";
import { ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOncloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export {registerUser}