import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, GripVertical, Download, FileText, Check, AlertCircle, Sun, Moon, Trash2, Share2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// PDF.js worker setup
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && files.length > 0) {
        setFiles([]);
        setError('');
      }
      if (e.key === ' ' && files.length >= 2 && !isProcessing) {
        e.preventDefault();
        mergePDFs();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [files, isProcessing]);

  // Load recent files from localStorage
  useEffect(() => {
    const recent = localStorage.getItem('recentMerge');
    if (recent) {
      const data = JSON.parse(recent);
      // Could show a "Load recent" option
    }
  }, []);

  // Generate thumbnail for PDF
  const generateThumbnail = async (file, fileId) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
      const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
      
      setThumbnails(prev => ({ ...prev, [fileId]: thumbnail }));
      
      // Return page count
      return pdf.numPages;
    } catch (err) {
      console.error('Thumbnail generation failed:', err);
      return null;
    }
  };

  const getTotalSize = () => {
    return files.reduce((acc, f) => acc + f.file.size, 0) / (1024 * 1024);
  };

  const handleFileSelect = (selectedFiles) => {
    const pdfFiles = Array.from(selectedFiles).filter(
      file => file.type === 'application/pdf'
    );

    if (pdfFiles.length === 0) {
      setError('Please select valid PDF files');
      return;
    }

    if (files.length + pdfFiles.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const newFilesSize = pdfFiles.reduce((acc, f) => acc + f.size, 0);
    const currentSize = files.reduce((acc, f) => acc + f.file.size, 0);
    const totalSizeMB = (currentSize + newFilesSize) / (1024 * 1024);
    
    if (totalSizeMB > MAX_SIZE_MB) {
      setError(`Total size cannot exceed ${MAX_SIZE_MB}MB`);
      return;
    }

    const newFiles = pdfFiles.map((file, index) => {
      const id = Date.now() + index;
      
      // Generate thumbnail and get page count
      generateThumbnail(file, id).then(pageCount => {
        if (pageCount) {
          setFiles(prevFiles => 
            prevFiles.map(f => 
              f.id === id ? { ...f, pageCount } : f
            )
          );
        }
      });
      
      return {
        id,
        file,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        pageCount: null
      };
    });

    setFiles(prev => [...prev, ...newFiles]);
    setError('');
    setIsComplete(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeFile = (id) => {
    setFiles(files.filter(f => f.id !== id));
    setIsComplete(false);
    setError('');
    const newThumbnails = { ...thumbnails };
    delete newThumbnails[id];
    setThumbnails(newThumbnails);
  };

  const clearAll = () => {
    setFiles([]);
    setThumbnails({});
    setError('');
    setIsComplete(false);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverItem = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFiles = [...files];
    const draggedFile = newFiles[draggedIndex];
    newFiles.splice(draggedIndex, 1);
    newFiles.splice(index, 0, draggedFile);

    setFiles(newFiles);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const mergePDFs = async () => {
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
        setProgress({ current: fileIndex + 1, total: files.length });
        
        const arrayBuffer = await fileObj.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport
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
          const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

          const width = imgWidth * ratio;
          const height = imgHeight * ratio;
          const x = (pdfWidth - width) / 2;
          const y = (pdfHeight - height) / 2;

          mergedPdf.addImage(imgData, 'JPEG', x, y, width, height);
        }
      }

      mergedPdf.save(`${fileName || 'merged-document'}.pdf`);
      
      // Save to recent
      localStorage.setItem('recentMerge', JSON.stringify({
        fileCount: files.length,
        date: new Date().toISOString()
      }));
      
      setIsProcessing(false);
      setIsComplete(true);
    } catch (err) {
      console.error('Error merging PDFs:', err);
      setError('Failed to merge PDFs. Please try again.');
      setIsProcessing(false);
    }
  };

  const shareResult = async () => {
    const text = `I just merged ${files.length} PDFs using @berkindev's PDF Merger! 🚀`;
    const url = window.location.href;
    
    try {
      if (navigator.share) {
        await navigator.share({ title: 'PDF Merger', text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  };

  const bgColor = theme === 'dark' ? 'bg-black' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-white' : 'text-black';
  const secondaryText = theme === 'dark' ? 'text-gray-600' : 'text-gray-500';
  const borderColor = theme === 'dark' ? 'border-gray-800' : 'border-gray-200';
  const cardBg = theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50';
  const hoverBg = theme === 'dark' ? 'hover:bg-gray-900' : 'hover:bg-gray-100';

  return (
    <div className={`min-h-screen ${bgColor} ${textColor} flex flex-col transition-colors duration-300`}>
      {/* Theme Toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={`fixed top-6 right-6 w-10 h-10 rounded-full ${cardBg} ${borderColor} border flex items-center justify-center ${hoverBg} transition-all z-10`}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-2">
              Merge PDFs
            </h1>
            <p className={`${secondaryText} text-sm`}>
              Fast • Private • No sign-up required
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-slide-in`}>
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* File Size Counter */}
          {files.length > 0 && (
            <div className={`mb-4 text-center text-sm ${secondaryText} animate-fade-in`}>
              {getTotalSize().toFixed(2)} MB / {MAX_SIZE_MB} MB • {files.length} / {MAX_FILES} files
            </div>
          )}

          {/* Upload Area */}
          {files.length === 0 ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative ${borderColor} border rounded-3xl p-16 sm:p-24 text-center transition-all duration-200 cursor-pointer animate-fade-in ${
                isDragging
                  ? `${theme === 'dark' ? 'border-white bg-gray-900/50' : 'border-black bg-gray-100'}`
                  : `${theme === 'dark' ? 'hover:border-gray-700' : 'hover:border-gray-300'}`
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
              <div className="flex flex-col items-center">
                <div className={`w-14 h-14 rounded-full ${cardBg} flex items-center justify-center mb-6`}>
                  <Upload className={`w-6 h-6 ${secondaryText}`} />
                </div>
                <h3 className="text-lg font-medium mb-1">
                  Drop PDF files
                </h3>
                <p className={`${secondaryText} text-sm`}>
                  or click to browse
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              {isProcessing && (
                <div className={`mb-6 ${cardBg} rounded-2xl p-4 animate-fade-in`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Processing...</span>
                    <span className="text-sm ${secondaryText}">{progress.current} / {progress.total}</span>
                  </div>
                  <div className={`w-full h-2 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* File Name Input */}
              <div className={`mb-6 ${cardBg} rounded-2xl p-3 flex items-center gap-2`}>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className={`flex-1 bg-transparent outline-none text-sm ${textColor}`}
                  placeholder="File name"
                />
                <span className={`text-sm ${secondaryText}`}>.pdf</span>
              </div>

              {/* Files List */}
              <div className="space-y-1.5 mb-6">
                {files.map((fileObj, index) => (
                  <div
                    key={fileObj.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOverItem(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`group flex items-center px-4 py-3.5 ${cardBg} rounded-2xl ${borderColor} border transition-all animate-slide-in ${
                      draggedIndex === index
                        ? 'opacity-40 scale-[0.98]'
                        : `${hoverBg} cursor-move`
                    }`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    {thumbnails[fileObj.id] && (
                      <img 
                        src={thumbnails[fileObj.id]} 
                        alt="Preview" 
                        className="w-10 h-12 object-cover rounded mr-3 flex-shrink-0"
                      />
                    )}
                    <GripVertical className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-700' : 'text-gray-400'} mr-3 flex-shrink-0`} />
                    <FileText className={`w-4 h-4 ${secondaryText} mr-3 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {fileObj.name}
                      </p>
                      <p className={`text-xs ${secondaryText} mt-0.5`}>
                        {fileObj.size}
                        {fileObj.pageCount && ` • ${fileObj.pageCount} ${fileObj.pageCount === 1 ? 'page' : 'pages'}`}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(fileObj.id)}
                      className={`ml-3 w-7 h-7 flex items-center justify-center rounded-full ${secondaryText} ${hoverBg} transition-all opacity-0 group-hover:opacity-100`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="mb-4 text-center">
                {files.length < MAX_FILES && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`py-2.5 text-sm ${secondaryText} ${hoverBg} rounded-full transition-colors px-8`}
                  >
                    + Add more
                  </button>
                )}
              </div>

              {files.length > 0 && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={clearAll}
                    className={`px-4 py-2.5 text-sm ${secondaryText} ${hoverBg} rounded-full transition-colors flex items-center gap-2`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />

              {/* Merge Button */}
              <button
                onClick={mergePDFs}
                disabled={isProcessing || files.length < 2}
                className={`w-full py-3.5 rounded-full font-medium transition-all ${
                  isProcessing
                    ? `${theme === 'dark' ? 'bg-gray-800 text-gray-600' : 'bg-gray-200 text-gray-400'} cursor-wait`
                    : isComplete
                    ? 'bg-green-600 text-white'
                    : files.length < 2
                    ? `${theme === 'dark' ? 'bg-gray-900 text-gray-600' : 'bg-gray-200 text-gray-400'} cursor-not-allowed`
                    : `${theme === 'dark' ? 'bg-white text-black hover:bg-gray-100' : 'bg-black text-white hover:bg-gray-800'}`
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <div className={`w-4 h-4 border-2 ${theme === 'dark' ? 'border-gray-600 border-t-gray-900' : 'border-gray-300 border-t-white'} rounded-full animate-spin mr-2.5`} />
                    Merging...
                  </span>
                ) : isComplete ? (
                  <span className="flex items-center justify-center">
                    <Check className="w-4 h-4 mr-2" />
                    Complete
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Download className="w-4 h-4 mr-2" />
                    Merge {files.length} files
                  </span>
                )}
              </button>

              {/* Share Button */}
              {isComplete && (
                <button
                  onClick={shareResult}
                  className={`w-full mt-3 py-2.5 rounded-full text-sm ${secondaryText} ${hoverBg} transition-colors flex items-center justify-center gap-2 animate-fade-in`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
              )}

              {files.length < 2 && (
                <p className={`text-center text-xs ${theme === 'dark' ? 'text-gray-700' : 'text-gray-400'} mt-3`}>
                  Add at least 2 files to merge • Press Space to merge • ESC to clear
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className={`w-full py-6 text-center ${borderColor} border-t`}>
        <a 
          href="https://instagram.com/berkindev" 
          target="_blank" 
          rel="noopener noreferrer"
          className={`text-xs ${theme === 'dark' ? 'text-gray-700 hover:text-gray-400' : 'text-gray-400 hover:text-gray-700'} transition-colors inline-flex items-center gap-1.5`}
        >
          Coded by <span className="font-medium">@sks</span>
        </a>
      </footer>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PDFMerger;
