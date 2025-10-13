"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MailOpen,
  Plus,
  FileText,
  Eye,
  AlertCircle,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";

interface EmailContentProps {
  subject: string;
  setSubject: (subject: string) => void;
  body: string;
  setBody: (body: string) => void;
  hideHtmlTags: boolean;
  setHideHtmlTags: (hide: boolean) => void;
  selectedTemplate: any;
  onSend: () => void;
  sending: boolean;
  mode: string;
  recipients: string;
  selectedUsers: any[];
  onPreview: () => void;
  onAIGenerate: () => void;
  aiGenerating: boolean;
}

export function EmailContent({
  subject,
  setSubject,
  body,
  setBody,
  hideHtmlTags,
  setHideHtmlTags,
  selectedTemplate,
  onSend,
  sending,
  mode,
  recipients,
  selectedUsers,
  onPreview,
  onAIGenerate,
  aiGenerating,
}: EmailContentProps) {
  // Function to strip HTML tags for clean view
  const stripHtmlTags = (html: string) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "");
  };

  // Function to convert plain text to HTML format
  const convertToHtml = (text: string) => {
    if (!text) return "";

    // Split by double line breaks to create paragraphs
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());

    if (paragraphs.length === 0) return text;

    // Wrap each paragraph in <p> tags and convert single line breaks to <br>
    return paragraphs
      .map((paragraph) => {
        const formatted = paragraph
          .trim()
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line)
          .join("<br>");
        return `<p>${formatted}</p>`;
      })
      .join("\n");
  };

  // Function to get display text for email body
  const getDisplayBody = () => {
    if (hideHtmlTags) {
      return stripHtmlTags(body);
    }
    return body;
  };

  // Function to handle body changes
  const handleBodyChange = (value: string) => {
    if (hideHtmlTags) {
      // If in clean view, convert to HTML when saving
      const htmlValue = convertToHtml(value);
      setBody(htmlValue);
    } else {
      setBody(value);
    }
  };

  // Function to toggle HTML view with warning
  const toggleHtmlView = () => {
    if (!hideHtmlTags && body.trim()) {
      // Switching from HTML to clean view - show warning
      const hasHtmlTags = /<[^>]*>/g.test(body);
      if (hasHtmlTags) {
        toast.info(
          "Switching to clean view - HTML tags will be hidden but preserved"
        );
      }
    } else if (hideHtmlTags && body.trim()) {
      const hasHtmlTags = /<[^>]*>/g.test(body);
      if (!hasHtmlTags) {
        const htmlBody = convertToHtml(body);
        setBody(htmlBody);
        toast.info("Plain text converted to HTML format");
      }
    }
    setHideHtmlTags(!hideHtmlTags);
  };

  // Default header and footer components
  const getDefaultHeader = () => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://bqitech.com";
    return `
      <div style="background: linear-gradient(135deg, #272055 0%, #31CDFF 100%); padding: 30px 20px; text-align: center; margin-bottom: 30px;">
        <img src="${baseUrl}/bqilogo-light.png" alt="BQI Tech Logo" style="max-width: 180px; height: auto; margin-bottom: 15px;">
        <div style="color: white; font-size: 14px; opacity: 0.9;">bqitech.com</div>
      </div>
    `;
  };

  const getDefaultFooter = () => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://bqitech.com";
    return `
      <div style="background-color: #f8f9fa; padding: 30px 20px; text-align: center; margin-top: 40px; border-top: 3px solid #31CDFF;">
        <div style="margin-bottom: 20px;">
          <img src="${baseUrl}/bqilogo-light.png" alt="BQI Tech Logo" style="max-width: 120px; height: auto; opacity: 0.8;">
        </div>
        <div style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 15px;">
          <strong>BQI Technologies</strong><br>
          Empowering businesses through innovative technology solutions
        </div>
        <div style="color: #999; font-size: 12px; margin-bottom: 20px;">
          Visit us at <a href="https://bqitech.com" style="color: #31CDFF; text-decoration: none;">bqitech.com</a>
        </div>
        <div style="color: #999; font-size: 12px;">
          Best regards,<br>
          <strong>The BQI Tech Team</strong>
        </div>
      </div>
    `;
  };

  const addHeaderFooter = () => {
    const header = getDefaultHeader();
    const footer = getDefaultFooter();
    const currentBody = body || "";
    const hasHeader = currentBody.includes("bqitech.com");
    const hasFooter = currentBody.includes("Best regards");

    let newBody = currentBody;
    if (!hasHeader) {
      newBody = header + newBody;
    }
    if (!hasFooter) {
      newBody = newBody + footer;
    }
    setBody(newBody);
    toast.success("Header and footer added to email");
  };

  const getRecipientCount = () => {
    switch (mode) {
      case "all":
        return "All users";
      case "list":
        return `${
          recipients.split(/[\,\n\s]+/).filter(Boolean).length
        } specific recipients`;
      case "search":
      case "broadcast":
        return `${selectedUsers.length} selected users`;
      default:
        return "No recipients";
    }
  };

  const isSendDisabled = () => {
    return (
      sending ||
      !subject.trim() ||
      !body.trim() ||
      (mode === "list" && !recipients.trim()) ||
      (mode === "search" && selectedUsers.length === 0) ||
      (mode === "broadcast" && selectedUsers.length === 0)
    );
  };

  return (
    <div className="space-y-6">
      {/* Email Content */}
      <Card className="border-2 border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailOpen className="h-5 w-5" />
            Email Content
          </CardTitle>
          <CardDescription>
            Compose your email subject and message
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-gray-700">
                Subject Line
              </Label>
              {selectedTemplate && (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-700"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Template Applied
                </Badge>
              )}
              {!selectedTemplate && (subject || body) && (
                <Badge
                  variant="secondary"
                  className="bg-purple-100 text-purple-700"
                >
                  <div className="w-2 h-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mr-1"></div>
                  AI Generated
                </Badge>
              )}
            </div>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="h-12 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-xl transition-all duration-200"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold text-gray-700">
                  Email Body
                </Label>
                <Badge
                  variant="secondary"
                  className={`${
                    hideHtmlTags
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {hideHtmlTags ? "Clean View" : "HTML Mode"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addHeaderFooter}
                  className="text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Header/Footer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleHtmlView}
                  className={`${
                    hideHtmlTags
                      ? "bg-green-100 text-green-700 border-green-200"
                      : "text-gray-600 border-gray-200"
                  } hover:bg-gray-50`}
                >
                  {hideHtmlTags ? (
                    <>
                      <FileText className="h-3 w-3 mr-1" />
                      Show HTML
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Hide HTML
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPreview}
                  disabled={!subject.trim() && !body.trim()}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
              </div>
            </div>
            <Textarea
              rows={12}
              value={hideHtmlTags ? getDisplayBody() : body}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder={
                hideHtmlTags
                  ? "Write your email content here...\n\nFor proper formatting:\n- Use double line breaks to create paragraphs\n- Single line breaks will become <br> tags\n- The system will automatically convert to HTML\n\nExample:\nDear valued user,\n\nWe hope this email finds you well. At BQI Tech, we are committed to continuously improving our services.\n\nYour feedback is invaluable in shaping our future direction.\n\nBest regards,\nThe BQI Tech Team"
                  : '<h1>Your Email Title</h1>\n<p>Write your email content here using HTML...</p>\n<p>You can use basic HTML tags like:</p>\n<ul>\n  <li><strong>Bold text</strong></li>\n  <li><em>Italic text</em></li>\n  <li><a href="#">Links</a></li>\n</ul>\n<p>Best regards,<br>The BQI Tech Team</p>'
              }
              className={`border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-xl transition-all duration-200 ${
                hideHtmlTags ? "text-sm" : "font-mono text-sm"
              }`}
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <AlertCircle className="h-4 w-4" />
              <span>
                {hideHtmlTags
                  ? "Clean writing mode: Write naturally with line breaks. Double line breaks create paragraphs, single line breaks create <br> tags. Use 'Show HTML' to edit raw HTML code."
                  : "HTML mode: Use HTML tags for formatting. Basic tags like <h1>, <p>, <strong>, <em>, <ul>, <li> are supported. Use <br> for line breaks within paragraphs."}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Send Button */}
      <Card className="border-2 border-gray-200 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-semibold text-gray-900">Ready to Send</div>
              <div className="text-sm text-gray-500">{getRecipientCount()}</div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onAIGenerate}
                disabled={aiGenerating}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
              >
                {aiGenerating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-white/20 rounded mr-1">
                      <span className="text-xs font-bold">AI</span>
                    </div>
                    Generate with AI
                  </div>
                )}
              </Button>
              <Button
                onClick={onSend}
                disabled={isSendDisabled()}
                className="h-12 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Email
                  </div>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
