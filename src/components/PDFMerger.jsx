import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  X,
  FileText,
  AlertCircle
} from 'lucide-react';

import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const MAX_FILES = 15;
const MAX_SIZE_MB = 150;

const PDFMerger = () => {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('merged-document');
  const [theme] = useState('light');

  const fileInputRef = useRef(null);

  const mergePDFs = useCallback(async () => {
    if (files.length < 2) return;

    setIsProcessing(true);
    setError('');

    try {
      const mergedPdf = new jsPDF();

      let isFirstPage = true;

      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const fileObj = files[fileIndex];

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

          const imgData = canvas.toDataURL(
            'image/jpeg',
            0.95
          );

          if (!isFirstPage) {
            mergedPdf.addPage();
          }

          isFirstPage = false;

          const pdfWidth =
            mergedPdf.internal.pageSize.getWidth();

          const pdfHeight =
            mergedPdf.internal.pageSize.getHeight();

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

      mergedPdf.save(
        `${fileName || 'merged-document'}.pdf`
      );

      setIsProcessing(false);
    } catch (err) {
      console.error(err);

      setError(
        'Failed to merge PDFs. Please try again.'
      );

      setIsProcessing(false);
    }
  }, [files, fileName]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (
        e.key === ' ' &&
        files.length >= 2 &&
        !isProcessing
      ) {
        e.preventDefault();
        mergePDFs();
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyPress
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyPress
      );
    };
  }, [files, isProcessing, mergePDFs]);

  const handleFileSelect = (selectedFiles) => {
    const pdfFiles = Array.from(selectedFiles).filter(
      (file) =>
        file.type === 'application/pdf'
    );

    if (pdfFiles.length === 0) {
      setError('Please select valid PDF files');
      return;
    }

    if (pdfFiles.length > MAX_FILES) {
      setError(
        `Maximum ${MAX_FILES} files allowed`
      );
      return;
    }

    const totalSize =
      pdfFiles.reduce(
        (acc, file) => acc + file.size,
        0
      ) /
      (1024 * 1024);

    if (totalSize > MAX_SIZE_MB) {
      setError(
        `Total size cannot exceed ${MAX_SIZE_MB}MB`
      );
      return;
    }

    const formattedFiles = pdfFiles.map(
      (file, index) => ({
        id: Date.now() + index,
        file,
        name: file.name,
        size:
          (
            file.size /
            (1024 * 1024)
          ).toFixed(2) + ' MB'
      })
    );

    setFiles(formattedFiles);

    setError('');
  };

  const removeFile = (id) => {
    setFiles(
      files.filter((file) => file.id !== id)
    );
  };

  const bgColor =
    theme === 'dark'
      ? 'bg-black'
      : 'bg-white';

  const textColor =
    theme === 'dark'
      ? 'text-white'
      : 'text-black';

  const secondaryText =
    theme === 'dark'
      ? 'text-gray-600'
      : 'text-gray-500';

  const borderColor =
    theme === 'dark'
      ? 'border-gray-800'
      : 'border-gray-200';

  const cardBg =
    theme === 'dark'
      ? 'bg-gray-900/50'
      : 'bg-gray-50';

  return (
    <div
      className={`min-h-screen ${bgColor} ${textColor} flex flex-col`}
    >
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">

          <div className="text-center mb-12">
            <h1 className="text-5xl font-semibold mb-2">
              Merge PDFs
            </h1>

            <p
              className={`${secondaryText} text-sm`}
            >
              Fast • Private • No sign-up required
            </p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-500" />

              <p className="text-sm text-red-500">
                {error}
              </p>
            </div>
          )}

          {files.length === 0 ? (
            <div
              className={`border ${borderColor} rounded-3xl p-16 text-center cursor-pointer`}
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                onChange={(e) =>
                  handleFileSelect(
                    e.target.files
                  )
                }
                className="hidden"
              />

              <div className="flex flex-col items-center">
                <div
                  className={`w-14 h-14 rounded-full ${cardBg} flex items-center justify-center mb-6`}
                >
                  <Upload
                    className={`w-6 h-6 ${secondaryText}`}
                  />
                </div>

                <h3 className="text-lg font-medium mb-1">
                  Drop PDF files
                </h3>

                <p
                  className={`${secondaryText} text-sm`}
                >
                  or click to browse
                </p>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`${cardBg} rounded-2xl p-3 mb-6`}
              >
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) =>
                    setFileName(
                      e.target.value
                    )
                  }
                  className={`w-full bg-transparent outline-none ${textColor}`}
                  placeholder="File name"
                />
              </div>

              <div className="space-y-2 mb-6">
                {files.map((fileObj) => (
                  <div
                    key={fileObj.id}
                    className={`flex items-center justify-between px-4 py-3 ${cardBg} rounded-2xl border ${borderColor}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText
                        className={`w-4 h-4 ${secondaryText}`}
                      />

                      <div>
                        <p className="text-sm font-medium">
                          {fileObj.name}
                        </p>

                        <p
                          className={`text-xs ${secondaryText}`}
                        >
                          {fileObj.size}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        removeFile(
                          fileObj.id
                        )
                      }
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={mergePDFs}
                disabled={isProcessing}
                className="w-full py-4 rounded-full bg-black text-white font-medium"
              >
                {isProcessing
                  ? 'Merging...'
                  : `Merge ${files.length} files`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFMerger;
