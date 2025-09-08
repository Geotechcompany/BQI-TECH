"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";

interface SimpleCVModalProps {
  isOpen: boolean;
  onClose: () => void;
  cvUrl: string;
  candidateName?: string;
}

export function SimpleCVModal({ isOpen, onClose, cvUrl, candidateName }: SimpleCVModalProps) {
  const [previewError, setPreviewError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setPreviewError(false);
      setIsLoading(true);
    }
  }, [isOpen]);

  const getPreviewUrl = useCallback((url: string): string => {
    if (!url) return '';
    
    try {
      const parsed = new URL(url);
      const isPdfPath = /\.pdf($|\?)/i.test(parsed.pathname + parsed.search);
      const isDropbox = parsed.hostname.includes('dropbox.com') || parsed.hostname.includes('dropboxusercontent.com');

      // Route through our proxy to bypass X-Frame-Options and CORS for allowed hosts
      const proxied = `/api/proxy?url=${encodeURIComponent(parsed.toString())}`;
      
      // Add zoom parameter for PDF files to set a better default view
      if (isPdfPath || isDropbox) {
        return proxied + '#zoom=75&toolbar=1&navpanes=0';
      }
      
      return proxied;
    } catch (error) {
      console.error('Error processing preview URL:', error);
      return url;
    }
  }, []);

  const getDownloadUrl = useCallback((url: string): string => {
    if (!url) return '';
    
    try {
      // Handle Google Drive URLs for download
      if (url.includes('drive.google.com')) {
        const fileId = url.match(/[-\w]{25,}/);
        if (fileId) {
          return `https://drive.google.com/uc?export=download&id=${fileId[0]}`;
        }
      }
      
      // Handle Dropbox URLs for download
      if (url.includes('dropbox.com')) {
        return url.replace('dl=0', 'dl=1');
      }
      
      // For direct file URLs, return as is
      return url;
    } catch (error) {
      console.error('Error processing download URL:', error);
      return url;
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!cvUrl) return;
    
    const downloadUrl = getDownloadUrl(cvUrl);
    
    // Extract filename from URL for better UX
    let filename = 'cv-document';
    try {
      const url = new URL(cvUrl);
      const pathParts = url.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart.includes('.')) {
        filename = lastPart;
      } else {
        // Try to determine file type
        const isPdf = /\.pdf($|\?)/i.test(url.pathname + url.search) || 
                     url.pathname.includes('pdf') || 
                     url.searchParams.has('pdf');
        filename = isPdf ? `cv-${candidateName || 'document'}.pdf` : `cv-${candidateName || 'document'}`;
      }
    } catch (e) {
      filename = `cv-${candidateName || 'document'}.pdf`;
    }
    
    // Create a temporary link for download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [cvUrl, candidateName, getDownloadUrl]);

  if (!isOpen || !cvUrl) return null;

  const previewUrl = getPreviewUrl(cvUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={onClose}
        aria-label="Close modal"
      />
      
      <div className="relative z-10 w-full max-w-4xl h-[90vh] mx-4 bg-white rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                {candidateName ? `${candidateName}'s CV` : 'Candidate CV'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden">
          {!previewError ? (
            <div className="w-full h-full bg-white border border-gray-300 rounded-lg overflow-hidden">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                  <div className="text-center space-y-2">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-sm text-gray-600">Loading CV...</p>
                  </div>
                </div>
              )}
              <iframe
                title={`CV - ${candidateName || 'Candidate'}`}
                src={previewUrl}
                className="w-full h-full"
                referrerPolicy="no-referrer"
                allow="fullscreen"
                style={{
                  border: 'none',
                  minHeight: '500px'
                }}
                onLoad={() => {
                  setIsLoading(false);
                  setPreviewError(false);
                }}
                onError={() => {
                  setIsLoading(false);
                  setPreviewError(true);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <FileText className="h-16 w-16 text-gray-400" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Unable to preview this document
                </h3>
                <p className="text-gray-600 max-w-md">
                  The document cannot be displayed in this preview. You can download it or open it in a new tab.
                </p>
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download CV
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
