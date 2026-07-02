"use client";

import React, { useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";
import { CVPreviewFrame } from "./CVPreviewFrame";

interface SimpleCVModalProps {
  isOpen: boolean;
  onClose: () => void;
  cvUrl: string;
  candidateName?: string;
}

export function SimpleCVModal({ isOpen, onClose, cvUrl, candidateName }: SimpleCVModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

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
          <div className="h-full min-h-[500px] rounded-lg border border-gray-300 bg-white">
            <CVPreviewFrame
              cvUrl={cvUrl}
              title={`CV - ${candidateName || "Candidate"}`}
              className="h-full min-h-[500px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
