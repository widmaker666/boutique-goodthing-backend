import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse } from 'cloudinary';
import 'multer';

@Injectable()
export class CloudinaryService {
  async uploadImage(file: Express.Multer.File, folder = 'encaissly/ventes'): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder }, (error, result) => {
          if (error || !result)
            return reject(new Error(error?.message ?? 'Upload failed'));
          resolve(result);
        })
        .end(file.buffer);
    });
  }
}
