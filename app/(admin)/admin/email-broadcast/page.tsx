"use client";

import { useState, useEffect } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Eye,
  History,
} from "lucide-react";
import { adminApi } from "@/lib/api-backend";
import { toast } from "sonner";

// Import components
import { RecipientSelection } from "./components/RecipientSelection";
import { EmailContent } from "./components/EmailContent";
import { EmailTemplates } from "./components/EmailTemplates";
import { QuickStats } from "./components/QuickStats";
import { TipsAndShortcuts } from "./components/TipsAndShortcuts";
import { EmailHistory } from "./components/EmailHistory";

export default function EmailBroadcastPage() {
  // Main state
  const [mode, setMode] = useState<"all" | "list" | "search" | "broadcast">(
    "all"
  );
  const [recipients, setRecipients] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [emailCount, setEmailCount] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<{
    subject: string;
    body: string;
  } | null>(null);
  const [hideHtmlTags, setHideHtmlTags] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [selectedBroadcastList, setSelectedBroadcastList] = useState<
    string | null
  >(null);
  const [showEmailHistory, setShowEmailHistory] = useState(false);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);

  // Load user count on component mount
  useEffect(() => {
    loadUserCount();
  }, []);

  // Clear broadcast list selection when switching away from broadcast mode
  useEffect(() => {
    if (mode !== "broadcast") {
      setSelectedBroadcastList(null);
    }
  }, [mode]);

  const loadUserCount = async () => {
    try {
      const response = await adminApi.getUsersCount();
      setEmailCount(response.count || 0);
    } catch (error) {
      console.error("Failed to load user count:", error);
    }
  };

  const generateAIEmail = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt for AI generation");
      return;
    }

    setAiGenerating(true);
    try {
      const response = await adminApi.generateAIEmail({ prompt: aiPrompt });

      if (response.subject && response.body) {
        setSubject(response.subject);
        setBody(response.body);
        setShowAIModal(false);
        setAiPrompt("");
        toast.success("AI email generated successfully!");
      } else {
        toast.error("Failed to generate email content");
      }
    } catch (error: any) {
      console.error("AI generation error:", error);
      toast.error("Failed to generate AI email", {
        description: error?.message,
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setBody(template.body);
  };

  const handleTemplatePreview = (template: any) => {
    setPreviewContent({
      subject: template.subject,
      body: template.body,
    });
    setShowTemplatePreview(true);
  };

  const previewCurrentEmail = () => {
    if (!subject.trim() && !body.trim()) {
      toast.error("Please enter subject and body to preview");
      return;
    }

    setPreviewContent({
      subject: subject,
      body: body,
    });
    setShowPreview(true);
  };

  const onSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Please enter subject and body");
      return;
    }

    let recipientList: string[] = [];

    switch (mode) {
      case "all":
        // Get all users for broadcast
        try {
          const response = await adminApi.getUsersCount();
          recipientList = ["all_users"]; // Special marker for all users
        } catch (error) {
          toast.error("Failed to get user count");
          return;
        }
        break;
      case "list":
        if (!recipients.trim()) {
          toast.error("Please enter recipient emails");
          return;
        }
        recipientList = recipients.split(/[,\n\s]+/).filter(Boolean);
        break;
      case "search":
        if (selectedUsers.length === 0) {
          toast.error("Please select users to send to");
          return;
        }
        recipientList = selectedUsers.map((user) => user.email);
        break;
      case "broadcast":
        if (!selectedBroadcastList) {
          toast.error("Please select a broadcast list");
          return;
        }
        if (selectedUsers.length === 0) {
          toast.error("No users found in selected broadcast list");
          return;
        }
        recipientList = selectedUsers.map((user) => user.email);
        break;
    }

    setSending(true);
    try {
      const response = await adminApi.sendEmailBroadcast({
        subject,
        body,
        recipients: recipientList,
        mode,
      });

      setResult(response);
      toast.success(
        `Email sent successfully to ${
          response.sent || recipientList.length
        } recipients`
      );

      // Refresh stats
      setStatsRefreshTrigger((prev) => prev + 1);

      // Reset form
      setSubject("");
      setBody("");
      setRecipients("");
      setSelectedUsers([]);
      setSelectedTemplate(null);
      setSelectedBroadcastList(null);
    } catch (error: any) {
      console.error("Send error:", error);
      setResult({ error: true, message: error.message });
      toast.error("Failed to send email", { description: error?.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminPageLayout title="Email Broadcast" showSearch={false} tourId="email-broadcast" guideInBanner>
      <TourPageHelper tourId="email-broadcast" />
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <AdminPageWelcomeBanner tourId="email-broadcast"
            bannerKey="email-broadcast"
            actions={
              <Button
                variant="secondary"
                onClick={() => setShowEmailHistory(true)}
                className="gap-2 bg-white text-[#272055] hover:bg-white/90"
                data-tour="email-broadcast-history"
              >
                <History className="h-4 w-4" />
                View History
              </Button>
            }
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="xl:col-span-2 space-y-6">
            {/* Recipient Selection */}
            <div data-tour="email-broadcast-recipients">
            <RecipientSelection
              mode={mode}
              setMode={setMode}
              recipients={recipients}
              setRecipients={setRecipients}
              selectedUsers={selectedUsers}
              setSelectedUsers={setSelectedUsers}
              emailCount={emailCount}
              onShowTips={() => setShowTips(true)}
              selectedBroadcastList={selectedBroadcastList}
              setSelectedBroadcastList={setSelectedBroadcastList}
            />
            </div>

            {/* Email Content */}
            <div data-tour="email-broadcast-content">
            <EmailContent
              subject={subject}
              setSubject={setSubject}
              body={body}
              setBody={setBody}
              hideHtmlTags={hideHtmlTags}
              setHideHtmlTags={setHideHtmlTags}
              selectedTemplate={selectedTemplate}
              onSend={onSend}
              sending={sending}
              mode={mode}
              recipients={recipients}
              selectedUsers={selectedUsers}
              onPreview={previewCurrentEmail}
              onAIGenerate={() => setShowAIModal(true)}
              aiGenerating={aiGenerating}
            />
            </div>

            {/* Results */}
            {result && (
              <Card
                className={`border-2 shadow-lg ${
                  result.error
                    ? "border-red-200 bg-red-50"
                    : "border-green-200 bg-green-50"
                }`}
              >
                <CardHeader>
                  <CardTitle
                    className={`flex items-center gap-2 ${
                      result.error ? "text-red-800" : "text-green-800"
                    }`}
                  >
                    {result.error ? (
                      <AlertCircle className="h-5 w-5" />
                    ) : (
                      <CheckCircle className="h-5 w-5" />
                    )}
                    {result.error ? "Error" : "Success"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`p-4 rounded-lg font-mono text-sm whitespace-pre-wrap break-words ${
                      result.error
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {JSON.stringify(result, null, 2)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <QuickStats
              emailCount={emailCount}
              refreshTrigger={statsRefreshTrigger}
            />

            {/* Email Templates */}
            <EmailTemplates
              onTemplateSelect={handleTemplateSelect}
              onTemplatePreview={handleTemplatePreview}
            />

            {/* Tips and Shortcuts */}
            <TipsAndShortcuts
              isOpen={showTips}
              onClose={() => setShowTips(false)}
            />
          </div>
        </div>

        {/* AI Email Generation Modal */}
        {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl mx-4">
              <Card className="border-2 border-gray-200 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-1 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                        <span className="text-white text-xs font-bold">AI</span>
                      </div>
                      AI Email Generator
                    </CardTitle>
                    <CardDescription>
                      Generate custom emails using AI
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowAIModal(false);
                      setAiPrompt("");
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      AI Prompt
                    </Label>
                    <Textarea
                      rows={4}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe the email you want to generate... (e.g., 'Welcome email for new employees with company policies')"
                      className="border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 rounded-xl"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={generateAIEmail}
                      disabled={!aiPrompt.trim() || aiGenerating}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    >
                      {aiGenerating ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full"></div>
                          Generate Email
                        </div>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAIModal(false);
                        setAiPrompt("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Email Preview Modal */}
        {showPreview && previewContent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
              <Card className="border-2 border-gray-200 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Email Preview
                    </CardTitle>
                    <CardDescription>
                      Preview how your email will look to recipients
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPreview(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      Subject: {previewContent.subject}
                    </Label>
                  </div>

                  {/* Email Body Preview */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <div className="text-sm text-gray-600">
                        Email Content:
                      </div>
                    </div>
                    <div
                      className="p-6 bg-white"
                      dangerouslySetInnerHTML={{
                        __html: previewContent.body,
                      }}
                    />
                  </div>
                </CardContent>
                <div className="flex gap-2 p-6 pt-0">
                  <Button
                    onClick={() => setShowPreview(false)}
                    className="flex-1"
                  >
                    Close Preview
                  </Button>
                  <Button
                    onClick={() => {
                      setSubject(previewContent.subject);
                      setBody(previewContent.body);
                      setShowPreview(false);
                    }}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Use This Email
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Template Preview Modal */}
        {showTemplatePreview && previewContent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
              <Card className="border-2 border-gray-200 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Template Preview
                    </CardTitle>
                    <CardDescription>
                      Preview the selected email template
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowTemplatePreview(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      Subject: {previewContent.subject}
                    </Label>
                  </div>

                  {/* Template Preview */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <div className="text-sm text-gray-600">
                        Template Content:
                      </div>
                    </div>
                    <div
                      className="p-6 bg-white"
                      dangerouslySetInnerHTML={{
                        __html: previewContent.body,
                      }}
                    />
                  </div>
                </CardContent>
                <div className="flex gap-2 p-6 pt-0">
                  <Button
                    onClick={() => setShowTemplatePreview(false)}
                    className="flex-1"
                  >
                    Close Preview
                  </Button>
                  <Button
                    onClick={() => {
                      setSubject(previewContent.subject);
                      setBody(previewContent.body);
                      setShowTemplatePreview(false);
                      toast.success("Template applied to email");
                    }}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Use This Template
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Email History Modal */}
      <EmailHistory
        isOpen={showEmailHistory}
        onClose={() => setShowEmailHistory(false)}
      />
    </AdminPageLayout>
  );
}
