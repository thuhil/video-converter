import { jsPDF } from "jspdf";

/**
 * Converts an image file to a different format (PNG, JPG) using HTML Canvas.
 */
export const convertImage = async (
  file: File,
  format: 'image/png' | 'image/jpeg',
  quality: number = 0.9
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
      
      // Fill white background for JPEGs to avoid black transparency
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
      reject(e);
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
      // Initialize jsPDF (A4 default)
      const doc = new jsPDF();
      
      // Calculate dimensions to fit A4 while maintaining aspect ratio
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      const widthRatio = pageWidth / img.width;
      const heightRatio = pageHeight / img.height;
      const ratio = widthRatio < heightRatio ? widthRatio : heightRatio;
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const imgData = canvas.toDataURL('image/jpeg', 1.0);

      const finalWidth = img.width * ratio;
      const finalHeight = img.height * ratio;
      
      // Center image
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
