const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) {
    // Overwrite the same user's previous avatar on every upload — one
    // file per user, named by their id, so disk usage never grows.
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, req.user.id + ext);
  },
});

const fileFilter = function (req, file, cb) {
  if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
  cb(null, true);
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
