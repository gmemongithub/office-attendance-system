require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  timezone: process.env.TZ || 'Asia/Dhaka',
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    contactEmail: process.env.VAPID_CONTACT_EMAIL,
  },
  defaults: {
    dailyTargetHours: parseFloat(process.env.DEFAULT_DAILY_TARGET_HOURS || '8'),
    autoCheckoutBufferHours: parseFloat(process.env.AUTO_CHECKOUT_BUFFER_HOURS || '4'),
    lunchMaxMinutes: parseInt(process.env.DEFAULT_LUNCH_MAX_MINUTES || '70', 10),
  },
};