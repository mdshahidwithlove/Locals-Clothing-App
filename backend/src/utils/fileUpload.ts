import { supabase } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';

const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'locals-bucket';

// Generate a presigned URL for file upload using Supabase Storage
export const generateUploadUrlProfile = async (
    fileType: string, 
    fileName: string, 
    role: string, 
    userId: string, 
    isPermanent: boolean = false
): Promise<{ uploadUrl: string; publicUrl: string }> => {
    try {
        const fileExtension = fileName.split('.').pop();
        const uniqueFileName = `${uuidv4()}.${fileExtension}`;
        
        // Determine the appropriate path based on file type and role
        let key: string;
        if (fileType === 'application/pdf') {
            // PDFs go into a separate folder
            key = `${role}/${userId}/pdfs/${uniqueFileName}`;
        } else if (fileName.toLowerCase().includes('cover')) {
            // Cover images go into a separate folder
            key = `${role}/${userId}/cover/${uniqueFileName}`;
        } else if (fileName.toLowerCase().includes('product')) {
            // Product images go into a separate folder
            key = `${role}/${userId}/products/${uniqueFileName}`;
        } else {
            // Profile pictures go into the root of the user's folder
            key = `${role}/${userId}/profile/${uniqueFileName}`;
        }

        // Generate a signed upload URL from Supabase (valid for 1 hour)
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUploadUrl(key);

        if (error) {
            console.error('Supabase signed URL generation failed:', error);
            throw error;
        }

        if (!data || !data.signedUrl) {
            throw new Error('Failed to generate signed upload URL from Supabase');
        }

        // Generate the public URL that will be accessible after upload
        const { data: publicData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(key);

        return { 
            uploadUrl: data.signedUrl, 
            publicUrl: publicData.publicUrl 
        };
    } catch (error) {
        console.error('Error generating upload URL:', error);
        throw new Error('Failed to generate upload URL');
    }
};

// Delete file from Supabase storage
export const deleteFileFromR2 = async (fileUrl: string): Promise<void> => {
    try {
        if (!fileUrl) return;
        
        // Extract the key from the URL
        let key = '';
        if (fileUrl.includes('/' + BUCKET_NAME + '/')) {
            key = fileUrl.split('/' + BUCKET_NAME + '/')[1];
        } else {
            // fallback: parse pathname
            const url = new URL(fileUrl);
            const parts = url.pathname.split('/');
            const bucketIndex = parts.indexOf(BUCKET_NAME);
            if (bucketIndex !== -1 && bucketIndex < parts.length - 1) {
                key = parts.slice(bucketIndex + 1).join('/');
            } else {
                key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
            }
        }
        
        console.log(`Attempting to delete file from Supabase with key: ${key}`);
        
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([key]);

        if (error) {
            console.error('Error deleting file from Supabase Storage:', error);
        } else {
            console.log(`File deleted successfully: ${key}`, data);
        }
    } catch (error) {
        console.error('Error deleting file from Supabase Storage:', error);
    }
};