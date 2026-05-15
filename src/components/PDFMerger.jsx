import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  X,
  GripVertical,
  Download,
  FileText,
  Check,
  AlertCircle,
  Sun,
  Moon,
  Trash2,
  Share2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const MAX_FILES = 15;
const MAX_SIZE_MB = 150;

const PDFMerger = () => {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [fileName, setFileName] = useState('merged-document');
  const [theme, setTheme] = useState('light');
  const [thumbnails, setThumbnails] = useState({});
  const fileInputRef = useRef(null);

  const mergePDFs = useCallback(async () => {
    if (files.length < 2) return;

    setIsProcessing(true);
    setIsComplete(false);
    setError('');
    setProgress({ current: 0, total: files.length });

    try {
      const mergedPdf = new jsPDF();
      let isFirstPage = true;

      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const fileObj = files[fileIndex];

        setProgress({
          current: fileIndex + 1,
          total: files.length
        });

        const arrayBuffer = await fileObj.file.arrayBuffer();

        const pdf = await pdfjsLib.getDocument({
          data: arrayBuffer
        }).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);

          const viewport = page.getViewport({
            scale: 2
          });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport
          }).promise;

          const imgData = canvas.toDataURL('image/jpeg', 0.95);

          if (!isFirstPage) {
            mergedPdf.addPage();
          }

          isFirstPage = false;

          const pdfWidth = mergedPdf.internal.pageSize.getWidth();
          const pdfHeight = mergedPdf.internal.pageSize.getHeight();

          const imgWidth = viewport.width;
          const imgHeight = viewport.height;

          const ratio = Math.min(
            pdfWidth / imgWidth,
            pdfHeight / imgHeight
          );

          const width = imgWidth * ratio;
          const height = imgHeight * ratio;

          const x = (pdfWidth - width) / 2;
          const y = (pdfHeight - height) / 2;

          mergedPdf.addImage(
            imgData,
            'JPEG',
            x,
            y,
            width,
            height
          );
        }
      }

      mergedPdf.save(`${fileName || 'merged-document'}.pdf`);

      localStorage.setItem(
        'recentMerge',
        JSON.stringify({
          fileCount: files.length,
          date: new Date().toISOString()
        })
      );

      setIsProcessing(false);
      setIsComplete(true);
    } catch (err) {
      console.error('Error merging PDFs:', err);

      setError('Failed to merge PDFs. Please try again.');
      setIsProcessing(false);
    }
  }, [files, fileName]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && files.length > 0) {
        setFiles([]);
        setError('');
      }

      if (
        e.key === ' ' &&
        files.length >= 2 &&
        !isProcessing
      ) {
        e.preventDefault();
        mergePDFs();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyPress
      );
    };
  }, [files, isProcessing, mergePDFs]);

  useEffect(() => {
    const recent = localStorage.getItem('recentMerge');

    if (recent) {
      JSON.parse(recent);
    }
  }, []);

  const generateThumbnail = async (file, fileId) => {
    try {
      const arrayBuffer = await file.arrayBuffer();

      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
      }).promise;

      const page = await pdf.getPage(1);

      const viewport = page.getViewport({
        scale: 0.5
      });

      const canvas = document.createElement('canvas');

      const context = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport
      }).promise;

      const thumbnail = canvas.toDataURL(
        'image/jpeg',
        0.7
      );

      setThumbnails((prev) => ({
        ...prev,
        [fileId]: thumbnail
      }));

      return pdf.numPages;
    } catch (err) {
      console.error(
        'Thumbnail generation failed:',
        err
      );

      return null;
    }
  };

  const getTotalSize = () => {
    return (
      files.reduce(
        (acc, f) => acc + f.file.size,
        0
      ) /
      (1024 * 1024)
    );
  };

  const handleFileSelect = (selectedFiles) => {
    const pdfFiles = Array.from(selectedFiles).filter(
      (file) => file.type === 'application/pdf'
    );

    if (pdfFiles.length === 0) {
      setError('Please select valid PDF files');
      return;
    }

    if (files.length + pdfFiles.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const newFilesSize = pdfFiles.reduce(
      (acc, f) => acc + f.size,
      0
    );

    const currentSize = files.reduce(
      (acc, f) => acc + f.file.size,
      0
    );

    const totalSizeMB =
      (currentSize + newFilesSize) /
      (1024 * 1024);

    if (totalSizeMB > MAX_SIZE_MB) {
      setError(
        `Total size cannot exceed ${MAX_SIZE_MB}MB`
      );
      return;
    }

    const newFiles = pdfFiles.map(
      (file, index) => {
        const id = Date.now() + index;

        generateThumbnail(file, id).then(
          (pageCount) => {
            if (pageCount) {
              setFiles((prevFiles) =>
                prevFiles.map((f) =>
                  f.id === id
                    ? { ...f, pageCount }
                    : f
                )
              );
            }
          }
        );

        return {
          id,
          file,
          name: file.name,
          size:
            (
              file.size /
              (1024 * 1024)
            ).toFixed(2) + ' MB',
          pageCount: null
        };
      }
    );

    setFiles((prev) => [...prev, ...newFiles]);

    setError('');
    setIsComplete(false);
  };

  return <div>Your existing JSX remains same below this point.</div>;
};

export default PDFMerger;
