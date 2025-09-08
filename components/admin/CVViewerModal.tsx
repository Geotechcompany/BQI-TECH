"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import Link from "next/link";

interface CVViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cvUrl: string;
  candidateName?: string;
}

export function CVViewerModal({ isOpen, onClose, cvUrl, candidateName }: CVViewerModalProps) {
  const [previewError, setPreviewError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPreviewError(false);
      setIsLoading(true);
      setRetryCount(0);
      
      // Set a timeout to show error if iframe doesn't load within 10 seconds
      const timeout = setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          setPreviewError(true);
        }
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [isOpen, isLoading]);

  const handleRetry = () => {
    setPreviewError(false);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
  };

  const getPreviewUrl = (url: string): string => {
    if (!url) return '';
    
    try {
      // Handle Google Drive URLs
      if (url.includes('drive.google.com')) {
        const fileId = url.match(/[-\w]{25,}/);
        if (fileId) {
          return `https://drive.google.com/file/d/${fileId[0]}/preview`;
        }
      }
      
      // Handle Dropbox URLs - use proxy for Dropbox files
      if (url.includes('dropbox.com')) {
        const proxiedUrl = `/api/proxy?url=${encodeURIComponent(url.replace('dl=0', 'raw=1'))}`;
        return proxiedUrl;
      }
      
      // For direct file URLs, return as is
      return url;
    } catch (error) {
      console.error('Error processing preview URL:', error);
      return url;
    }
  };

  const getDownloadUrl = (url: string): string => {
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
  };

  if (!cvUrl) return null;

  const previewUrl = getPreviewUrl(cvUrl);
  const downloadUrl = getDownloadUrl(cvUrl);

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={true}>
      <DialogContent 
        className="max-w-4xl w-full h-[90vh] flex flex-col p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={onClose}
      >
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-semibold">
                {candidateName ? `${candidateName}'s CV` : 'Candidate CV'}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <Link href={downloadUrl} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <Link href={cvUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Link>
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
        </DialogHeader>
        
        <div className="flex-1 p-6 overflow-hidden">
          {!previewError ? (
            <div className="w-full h-full bg-white border border-border rounded-lg overflow-hidden relative">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                  <div className="text-center space-y-2">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-sm text-muted-foreground">Loading CV...</p>
                  </div>
                </div>
              )}
              <iframe
                key={`iframe-${retryCount}`}
                title={`CV - ${candidateName || 'Candidate'}`}
                src={previewUrl}
                className="w-full h-full border-0"
                referrerPolicy="no-referrer"
                allow="fullscreen"
                loading="lazy"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                onLoad={() => {
                  console.log('Iframe loaded successfully');
                  setIsLoading(false);
                  setPreviewError(false);
                }}
                onError={() => {
                  console.error('Iframe failed to load');
                  setIsLoading(false);
                  setPreviewError(true);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Unable to preview this document
                </h3>
                <p className="text-muted-foreground max-w-md">
                  The document cannot be displayed in this preview. You can download it or open it in a new tab.
                </p>
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                {retryCount < 2 && (
                  <Button variant="secondary" onClick={handleRetry}>
                    Try Again
                  </Button>
                )}
                <Button asChild>
                  <Link href={downloadUrl} download>
                    <Download className="h-4 w-4 mr-2" />
                    Download CV
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={cvUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
