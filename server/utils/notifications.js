import Notification from "../models/Notification.js";
import User from "../models/User.js";

export const notifyUsers = async ({
  userIds = [],
  type = "SYSTEM",
  title,
  message,
  link = "",
}) => {
  const ids = [
    ...new Set(
      userIds
        .map((id) => id?.toString())
        .filter(Boolean),
    ),
  ];

  if (!ids.length) return;

  await Notification.insertMany(
    ids.map((userId) => ({
      userId,
      type,
      title,
      message,
      link,
    })),
  );
};

export const notifyRole = async ({
  role,
  type,
  title,
  message,
  link = "",
}) => {
  const users = await User.find({ role })
    .select("_id")
    .lean();

  await notifyUsers({
    userIds: users.map((user) => user._id),
    type,
    title,
    message,
    link,
  });
};