#!/bin/bash

# Frontend deployment script for AWS S3 + CloudFront
# This script will be used when we're ready to deploy to AWS

set -e

echo "🚀 Building frontend for production..."

# Build the React app
cd frontend
npm run build:prod

echo "📦 Build complete! Files ready in frontend/dist/"

# When ready to deploy to AWS, uncomment these lines:
# echo "☁️  Uploading to S3..."
# aws s3 sync dist/ s3://your-bucket-name/ --delete
# 
# echo "🔄 Invalidating CloudFront cache..."
# aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
# 
# echo "✅ Deployment complete!"

echo "📝 Next steps:"
echo "1. Create S3 bucket for static hosting"
echo "2. Set up CloudFront distribution"
echo "3. Update API_URL in build:prod script"
echo "4. Run this script to deploy"