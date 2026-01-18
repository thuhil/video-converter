import { jsPDF } from "jspdf";

export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Converts an image file to a different format (PNG, JPG, WEBP) using HTML Canvas.
 */
export const convertImage = async (
  file: File,
  format: 'image/png' | 'image/jpeg' | 'image/webp',
  quality: number = 0.92
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      // Handle transparency for JPEG
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Conversion failed"));
          URL.revokeObjectURL(url);
        },
        format,
        quality
      );
    };
    
    img.onerror = (e) => {
      reject(new Error("Failed to load image"));
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  });
};

/**
 * Converts an image to PDF using jsPDF.
 */
export const convertImageToPDF = async (file: File): Promise<Blob> => {
   return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      const widthRatio = pageWidth / img.width;
      const heightRatio = pageHeight / img.height;
      const ratio = Math.min(widthRatio, heightRatio);
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      const finalWidth = img.width * ratio;
      const finalHeight = img.height * ratio;
      
      const x = (pageWidth - finalWidth) / 2;
      const y = (pageHeight - finalHeight) / 2;

      doc.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
      
      const pdfOutput = doc.output('blob');
      resolve(pdfOutput);
      URL.revokeObjectURL(url);
    };

    img.onerror = reject;
    img.src = url;
   });
};
