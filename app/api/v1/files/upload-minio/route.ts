import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * MinIO Upload Proxy
 * 
 * Handles MinIO file uploads server-side since MinIO requires AWS SDK
 * for proper signature v4 signing, which is complex to do client-side.
 * 
 * This endpoint proxies file uploads to MinIO using AWS SDK.
 */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;
    const filePath = formData.get('filePath') as string;
    const fileType = formData.get('fileType') as string;
    const bucketName = formData.get('bucketName') as string;
    const serverPath = formData.get('serverPath') as string;
    const serverPort = formData.get('serverPort') as string;
    const accessKey = formData.get('accessKey') as string;
    const secretKey = formData.get('secretKey') as string;

    if (!file || !fileName || !filePath || !bucketName || !serverPath || !accessKey || !secretKey) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Build MinIO endpoint URL
    const port = serverPort && serverPort !== '443' && serverPort !== '80' ? `:${serverPort}` : '';
    const endpoint = serverPath.startsWith('http') ? `${serverPath}${port}` : `https://${serverPath}${port}`;

    // Create S3-compatible client for MinIO
    const s3Client = new S3Client({
      endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      region: 'us-east-1', // MinIO doesn't care about region, but AWS SDK requires it
      forcePathStyle: true, // Required for MinIO
    });

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to MinIO
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: fileType || 'application/octet-stream',
      })
    );

    // Construct file URL (MinIO format: endpoint/bucket/key)
    const fileUrl = `${endpoint}/${bucketName}/${filePath}`;

    return NextResponse.json({ file_url: fileUrl });
  } catch (error) {
    console.error('[MinIO Upload] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload file to MinIO',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

