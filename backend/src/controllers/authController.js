import { User } from '../models/index.js';
import { loginUser, registerUser } from '../services/authService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const { user, token } = await registerUser(req.body);
  res.status(201).json({
    success: true,
    message: 'Account registered successfully',
    data: { user, token },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await loginUser(req.body);
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user, token },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const allowedUpdates = {};
  if (req.body.name !== undefined) allowedUpdates.name = req.body.name;
  if (req.body.phone !== undefined) allowedUpdates.phone = req.body.phone;
  if (req.body.address !== undefined) allowedUpdates.address = req.body.address;

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $set: allowedUpdates },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updated },
  });
});
