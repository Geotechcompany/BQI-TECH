import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Application, StatusHistoryEntry } from "@/types/application";
import { getNameDisplay, getEmailDisplay, getPositionDisplay, extractDataFromAnswers, getCvUrl } from "./utils/table-utils";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  getProxiedUrl,
  getDownloadUrl,
  getProxyFetchUrl,
  getCvDisplayLabel,
  isNonPreviewableDoc,
  isPreviewableContentType,
} from "@/lib/cv-url-utils";
import { 
  UserIcon, 
  BriefcaseIcon, 
  FileTextIcon, 
  FileIcon, 
  ArrowUpRightIcon,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ViewApplicationModalProps {
  application: Application | null;
  isOpen: boolean;
  onClose: () => void;
  jobTitles?: Record<string, string>;
  showApplicationId?: boolean;
}

export function ViewApplicationModal({
  application,
  isOpen,
  onClose,
  jobTitles = {},
  showApplicationId = true,
}: ViewApplicationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);

  const cvUrl = application ? getCvUrl(application) : "";

  useEffect(() => {
    if (!isOpen || !cvUrl) {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
      setPreviewBlobUrl(null);
      setPreviewError(false);
      setIsPreviewLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPreview() {
      setPreviewError(false);
      setIsPreviewLoading(true);

      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
      setPreviewBlobUrl(null);

      if (isNonPreviewableDoc(cvUrl)) {
        setIsPreviewLoading(false);
        return;
      }

      try {
        const response = await fetch(getProxyFetchUrl(cvUrl));
        if (cancelled) return;

        if (!response.ok) {
          throw new Error(`Proxy returned ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";

        if (!isPreviewableContentType(contentType, cvUrl)) {
          setIsPreviewLoading(false);
          return;
        }

        const blob = await response.blob();
        if (cancelled) return;

        const objectUrl = URL.createObjectURL(blob);
        previewBlobUrlRef.current = objectUrl;
        setPreviewBlobUrl(objectUrl);
        setIsPreviewLoading(false);
      } catch {
        if (!cancelled) {
          setPreviewError(true);
          setIsPreviewLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };
  }, [isOpen, cvUrl]);

  if (!application) return null;

  const handleViewResume = () => {
    if (application.cvUrl) {
      setIsLoading(true);
      const link = document.createElement("a");
      link.href = application.cvUrl;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsLoading(false);
    }
  };

  const isLikelyUrl = (value: unknown) => {
    if (typeof value !== 'string') return false;
    try {
      // Basic validation via URL constructor
      // Also accept strings starting with www.
      if (value.startsWith('www.')) return true;
      // eslint-disable-next-line no-new
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const isResumeQuestion = (text: unknown) => {
    const q = (typeof text === 'string' ? text : '').toLowerCase();
    return q.includes('upload resume') || q.includes('resume/cv') || q.includes('cv');
  };

  function getAnswer(answers: any[] | undefined, question: string) {
    if (!answers || !Array.isArray(answers)) return '';
    
    return answers.find(a => 
      a?.questionText?.toLowerCase().includes(question.toLowerCase())
    )?.answer || '';
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="w-[95vw] max-w-4xl h-[95vh] max-h-[95vh] p-0 rounded-xl sm:rounded-2xl overflow-hidden"
      >
        {/* Mobile-friendly header with close button */}
        <DialogHeader className="relative p-4 sm:p-6 pb-2 sm:pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                Application Details
              </DialogTitle>
              <DialogDescription className="text-gray-500 text-xs sm:text-sm mt-1">
                Comprehensive overview of candidate application
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 flex-shrink-0 sm:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4 sm:space-y-6">
            {showApplicationId && (
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                <span className="text-xs font-medium text-gray-400">Application ID</span>
                <p className="font-mono text-xs sm:text-sm text-gray-700 mt-1 break-all">
                  {application.id || application._id}
                </p>
              </div>
            )}

            {/* Main Info Grid - Stack on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="p-4 sm:p-5 bg-white border border-gray-100 rounded-lg sm:rounded-xl shadow-sm">
                <h4 className="text-sm sm:text-base font-semibold text-gray-500 flex items-center gap-2 mb-3 sm:mb-4">
                  <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                  <span>Candidate Info</span>
                </h4>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Full Name</p>
                    <p className="text-sm sm:text-base text-gray-700 font-medium break-words">
                      {application.name || 
                       `${getAnswer(application.answers, 'First Name')} ${getAnswer(application.answers, 'Last Name')}`.trim() || 
                       'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Contact Email</p>
                    <p className="text-sm sm:text-base text-gray-700 font-medium break-all">
                      {application.email?.toLowerCase() || 
                       getAnswer(application.answers, 'Email') || 
                       'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Phone Number</p>
                    <p className="text-sm sm:text-base text-gray-700 font-medium break-words">
                      {application.phoneNumber || 
                       getAnswer(application.answers, 'Phone') || 
                       'Not provided'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 bg-white border border-gray-100 rounded-lg sm:rounded-xl shadow-sm">
                <h4 className="text-sm sm:text-base font-semibold text-gray-500 flex items-center gap-2 mb-3 sm:mb-4">
                  <BriefcaseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 flex-shrink-0" />
                  <span>Position Info</span>
                </h4>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Applied Position</p>
                    <p className="text-sm sm:text-base text-gray-700 font-medium break-words">
                      {getPositionDisplay(application, jobTitles)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Application Date</p>
                    <p className="text-sm sm:text-base text-gray-700 font-medium">
                      {formatDate(application.appliedDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Current Status</p>
                    <span className={`inline-flex px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium ${
                      application.status === 'Hired' ? 'bg-green-100 text-green-700' :
                      application.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {application.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Answers Section */}
            <div className="p-4 sm:p-5 bg-white border border-gray-100 rounded-lg sm:rounded-xl shadow-sm">
              <h4 className="text-sm sm:text-base font-semibold text-gray-500 flex items-center gap-2 mb-4 sm:mb-5">
                <FileTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                <span>Application Responses</span>
              </h4>
              <div className="space-y-4 sm:space-y-5">
                {application.answers?.map((answer, index) => (
                  <div key={index} className="group relative">
                    <div className="border-l-2 border-gray-200 pl-4 sm:pl-6">
                      <p className="text-sm sm:text-base font-medium text-gray-700 mb-2 leading-relaxed">
                        {answer.questionText}
                      </p>
                      {!isResumeQuestion(answer?.questionText) || !isLikelyUrl(answer?.answer) ? (
                        <div className="text-sm sm:text-base text-gray-600 bg-gray-50 rounded-lg p-3 sm:p-4 leading-relaxed break-words">
                          {answer.answer || 'No answer provided'}
                        </div>
                      ) : (
                        <div className="text-sm sm:text-base text-gray-600 bg-gray-50 rounded-lg p-3 sm:p-4">
                          <Link
                            href={getProxiedUrl(String(answer.answer))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline font-medium"
                          >
                            {getCvDisplayLabel(String(answer.answer))}
                          </Link>
                          <p className="text-xs text-gray-500 mt-2">
                            CV preview is available in the &quot;Attached Documents&quot; section below
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-6 sm:py-8 text-gray-400">
                    <FileTextIcon className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                    <p className="text-sm sm:text-base">No responses available</p>
                  </div>
                )}
              </div>
            </div>

            {cvUrl ? (
              <div className="p-4 sm:p-5 bg-white border border-gray-100 rounded-lg sm:rounded-xl shadow-sm">
                <h4 className="text-sm sm:text-base font-semibold text-gray-500 flex items-center gap-2 mb-4 sm:mb-5">
                  <FileIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0" />
                  <span>Attached Documents</span>
                </h4>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 sm:p-3 bg-white rounded-lg shadow-sm flex-shrink-0">
                      <FileTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm sm:text-base font-medium text-gray-700 truncate">Candidate CV</p>
                      <p className="text-xs sm:text-sm text-gray-400">Uploaded {formatDate(application.appliedDate)}</p>
                    </div>
                    <Link
                      href={getProxiedUrl(cvUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-700 text-sm font-medium bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-all duration-200"
                    >
                      <span>Open in new tab</span>
                      <ArrowUpRightIcon className="w-4 h-4" />
                    </Link>
                  </div>

                  {isPreviewLoading ? (
                    <div className="w-full h-[60vh] sm:h-[70vh] bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
                        <p className="text-sm text-gray-500">Loading CV preview...</p>
                      </div>
                    </div>
                  ) : previewBlobUrl ? (
                    <div className="w-full h-[60vh] sm:h-[70vh] bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <iframe
                        title="CV Preview"
                        src={`${previewBlobUrl}#zoom=75&toolbar=1&navpanes=0`}
                        className="w-full h-full"
                        referrerPolicy="no-referrer"
                        allow="fullscreen"
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 p-4 bg-white border border-gray-200 rounded-lg">
                      {previewError ? (
                        <p className="mb-2">Unable to preview this document inline.</p>
                      ) : (
                        <p className="mb-2">
                          This document type cannot be previewed in the browser. You can open or download it instead.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={getProxiedUrl(cvUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-blue-600 underline"
                        >
                          Open in new tab
                          <ArrowUpRightIcon className="w-4 h-4" />
                        </Link>
                        <Link
                          href={getDownloadUrl(cvUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-blue-600 underline"
                        >
                          Download CV
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Bottom padding for mobile scroll */}
            <div className="h-4 sm:h-0" />
            
            
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
