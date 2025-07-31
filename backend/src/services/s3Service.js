const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configure AWS SDK
const s3Config = {
  region: process.env.AWS_REGION || 'us-east-1',
};

// Use LocalStack endpoint in development
if (process.env.NODE_ENV === 'development' && process.env.AWS_ENDPOINT) {
  s3Config.endpoint = process.env.AWS_ENDPOINT;
  s3Config.s3ForcePathStyle = true;
  s3Config.accessKeyId = 'test';
  s3Config.secretAccessKey = 'test';
}

const s3 = new AWS.S3(s3Config);
const BUCKET_NAME = process.env.S3_BUCKET || 'landlord-dashboard-exports';

const s3Service = {
  // Initialize bucket (for local development)
  initializeBucket: async () => {
    try {
      // Check if bucket exists
      await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
      console.log(`Bucket ${BUCKET_NAME} already exists`);
    } catch (error) {
      if (error.code === 'NotFound') {
        // Create bucket
        await s3.createBucket({ Bucket: BUCKET_NAME }).promise();
        console.log(`Created bucket ${BUCKET_NAME}`);
      } else {
        throw error;
      }
    }
  },

  // Upload file to S3
  uploadFile: async (filePath, s3Key) => {
    try {
      const fileContent = await fs.readFile(filePath);
      const contentType = path.extname(filePath) === '.xlsx' 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/octet-stream';

      const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
        Metadata: {
          'uploaded-by': 'landlord-dashboard',
          'upload-date': new Date().toISOString()
        }
      };

      const result = await s3.upload(params).promise();
      console.log(`File uploaded successfully to ${result.Location}`);
      
      return {
        location: result.Location,
        bucket: result.Bucket,
        key: result.Key,
        etag: result.ETag
      };
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw error;
    }
  },

  // Get presigned URL for download
  getPresignedUrl: async (s3Key, expiresIn = 3600) => {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Expires: expiresIn // URL expires in 1 hour by default
      };

      const url = await s3.getSignedUrlPromise('getObject', params);
      return url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw error;
    }
  },

  // Download file from S3
  downloadFile: async (s3Key, downloadPath) => {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key
      };

      const data = await s3.getObject(params).promise();
      await fs.writeFile(downloadPath, data.Body);
      
      console.log(`File downloaded successfully to ${downloadPath}`);
      return downloadPath;
    } catch (error) {
      console.error('Error downloading file from S3:', error);
      throw error;
    }
  },

  // List files in bucket
  listFiles: async (prefix = '') => {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Prefix: prefix
      };

      const data = await s3.listObjectsV2(params).promise();
      return data.Contents.map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        etag: item.ETag
      }));
    } catch (error) {
      console.error('Error listing files from S3:', error);
      throw error;
    }
  },

  // Delete file from S3
  deleteFile: async (s3Key) => {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key
      };

      await s3.deleteObject(params).promise();
      console.log(`File ${s3Key} deleted successfully`);
      return true;
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw error;
    }
  },

  // Check if file exists
  fileExists: async (s3Key) => {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key
      };

      await s3.headObject(params).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
};

module.exports = s3Service;