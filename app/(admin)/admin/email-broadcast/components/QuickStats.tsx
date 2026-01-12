"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Mail, Clock, RefreshCw } from "lucide-react";
import { adminApi } from "@/lib/api-backend";

interface QuickStatsProps {
  emailCount: number;
  refreshTrigger?: number;
}

export function QuickStats({ emailCount, refreshTrigger }: QuickStatsProps) {
  const [emailsSent, setEmailsSent] = useState(0);
  const [lastSent, setLastSent] = useState("Never");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmailStats();
  }, [refreshTrigger]);

  const loadEmailStats = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getEmailCampaigns({ limit: 50 });

      console.log("Email campaigns response:", response); // Debug log

      if (response.campaigns && response.campaigns.length > 0) {
        // Calculate total emails sent across all campaigns
        const totalSent = response.campaigns.reduce((sum, campaign) => {
          console.log("Campaign data:", campaign); // Debug log
          return sum + (campaign.succeeded || 0);
        }, 0);
        setEmailsSent(totalSent);

        // Get the most recent campaign date
        const latestCampaign = response.campaigns[0];
        if (latestCampaign.created_at) {
          const date = new Date(latestCampaign.created_at);
          setLastSent(date.toLocaleDateString());
        }
      } else {
        console.log("No campaigns found in response");
      }
    } catch (error) {
      console.error("Failed to load email stats:", error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card className="border-2 border-gray-200 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-green-800">
            <TrendingUp className="h-5 w-5" />
            Quick Stats
          </CardTitle>
          <button
            onClick={loadEmailStats}
            disabled={loading}
            className="p-1 hover:bg-green-100 rounded transition-colors"
            title="Refresh stats"
          >
            <RefreshCw
              className={`h-4 w-4 text-green-600 ${
                loading ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700">Total Users</span>
          </div>
          <span className="font-semibold text-green-800">{emailCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700">Emails Sent</span>
          </div>
          <span className="font-semibold text-green-800">{emailsSent}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-600" />
            <span className="text-sm text-purple-700">Last Sent</span>
          </div>
          <span className="font-semibold text-purple-800">{lastSent}</span>
        </div>
      </CardContent>
    </Card>
  );
}
