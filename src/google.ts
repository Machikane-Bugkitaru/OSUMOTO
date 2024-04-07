import { Stream } from 'node:stream';
import path from 'path';
import { google } from "googleapis";

export const uploadImage = async (fileName: string, base64Data: string) => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../credentials.json'),
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.appdata',
    ],
  });
  const drive = google.drive({version: 'v3', auth});

  const bs = new Stream.PassThrough();
  bs.end(Buffer.from(base64Data, "base64"));

  const params = {
      resource: {
          name: fileName,
          parents: ['1lLo7CG0ZdhTooWsAsC2NEs34QEUb8UgZ']
      },
      media: {
          mimeType: 'image/png',
          body: bs,
      },
      fields: 'id'
  };

  const response = await drive.files.create(params);
  const { status, statusText } = response;
  if (status < 200 || status >= 400) {
    console.error(`uploadImage: status=${status}, message=${statusText}`);
    throw new Error(`status: ${status}, message: ${statusText}`);
  }
  return `https://drive.google.com/uc?id=${response.data.id}`
}
