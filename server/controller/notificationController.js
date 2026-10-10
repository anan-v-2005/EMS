import Notification from "../models/Notification.js";

export const getNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const data = await Notification.find({ userId: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const unread = await Notification.countDocuments({ userId: req.session.userId, read: false });
    res.json({ data, unread });
  } catch (error) {
    console.error("Notifications error:", error);
    res.status(500).json({ error: "Failed to load notifications" });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      { read: true },
      { returnDocument: "after" },
    );
    if (!item) return res.status(404).json({ error: "Notification not found" });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notification" });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.session.userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notifications" });
  }
};
