"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardGridSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  History,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Eye,
  Calendar,
} from "lucide-react";
import { adminApi } from "@/lib/api-backend";
import { toast } from "sonner";

interface EmailCampaign {
  _id: string;
  subject: string;
  campaign_name: string;
  recipient_count: number;
  sent_by: string;
  created_at: string;
  status: string;
  succeeded?: number;
  failed?: number;
}

interface EmailLog {
  _id: string;
  campaign_id: string;
  recipient_email: string;
  subject: string;
  sent_at: string;
  status: string;
  error?: string;
}

interface EmailHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmailHistory({ isOpen, onClose }: EmailHistoryProps) {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] =
    useState<EmailCampaign | null>(null);
  const [campaignLogs, setCampaignLogs] = useState<EmailLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCampaigns();
    }
  }, [isOpen]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getEmailCampaigns({ limit: 20 });
      setCampaigns(response.campaigns || []);
    } catch (error) {
      console.error("Failed to load campaigns:", error);
      toast.error("Failed to load email campaigns");
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignLogs = async (campaignId: string) => {
    setLogsLoading(true);
    try {
      const response = await adminApi.getEmailCampaignDetails(campaignId);
      setCampaignLogs(response.logs || []);
      setShowLogs(true);
    } catch (error) {
      console.error("Failed to load campaign logs:", error);
      toast.error("Failed to load campaign details");
    } finally {
      setLogsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Completed
          </Badge>
        );
      case "sending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Sending
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLogStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Email Sending History
            </DialogTitle>
            <DialogDescription>
              View and track all email campaigns sent through the system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <CardGridSkeleton count={3} className="sm:grid-cols-1 xl:grid-cols-1" />
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Mail className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500">No email campaigns found</p>
                  <p className="text-sm text-gray-400">
                    Send your first email to see it here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <Card
                    key={campaign._id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {campaign.subject}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {campaign.campaign_name}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(campaign.status)}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadCampaignLogs(campaign._id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          <span>{campaign.recipient_count} recipients</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span>{formatDate(campaign.created_at)}</span>
                        </div>
                        {campaign.succeeded !== undefined && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>{campaign.succeeded} sent</span>
                          </div>
                        )}
                        {campaign.failed !== undefined &&
                          campaign.failed > 0 && (
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-red-500" />
                              <span>{campaign.failed} failed</span>
                            </div>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Dialog */}
      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Campaign Details
            </DialogTitle>
            <DialogDescription>
              Individual email delivery status for this campaign
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {logsLoading ? (
              <TableSkeleton rows={6} columns={4} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignLogs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell className="font-medium">
                        {log.recipient_email}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getLogStatusIcon(log.status)}
                          <span className="capitalize">{log.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(log.sent_at)}</TableCell>
                      <TableCell>
                        {log.error && (
                          <span className="text-red-600 text-sm">
                            {log.error}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
