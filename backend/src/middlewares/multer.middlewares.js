import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Conditional logic based on file mimetype
        if (file.mimetype === 'application/pdf') {
            // PDFs go to documents folder
            cb(null, path.resolve('./public/documents'))
        } else if (file.mimetype.startsWith('image/')) {
            // Images go to images folder
            cb(null, path.resolve('./public/images'))
        } else {
            // Default fallback
            cb(null, path.resolve('./public/uploads'))
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix)
    }
})

export const upload = multer({
    storage: storage,
    limits: {
        fieldSize: 1*1000*1000
    }
})