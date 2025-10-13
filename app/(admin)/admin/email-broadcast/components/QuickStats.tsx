"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Mail, Clock } from "lucide-react";

interface QuickStatsProps {
  emailCount: number;
  emailsSent: number;
  lastSent: string;
}

export function QuickStats({
  emailCount,
  emailsSent,
  lastSent,
}: QuickStatsProps) {
  return (
    <Card className="border-2 border-gray-200 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-green-800">
          <TrendingUp className="h-5 w-5" />
          Quick Stats
        </CardTitle>
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
