"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import Link from "next/link";
import { CVPreviewFrame } from "./CVPreviewFrame";

interface CVViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cvUrl: string;
  candidateName?: string;
}

export function CVViewerModal({ isOpen, onClose, cvUrl, candidateName }: CVViewerModalProps) {
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
          <CVPreviewFrame
            cvUrl={cvUrl}
            title={`CV - ${candidateName || "Candidate"}`}
            className="h-full min-h-[500px] rounded-lg border border-border"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
