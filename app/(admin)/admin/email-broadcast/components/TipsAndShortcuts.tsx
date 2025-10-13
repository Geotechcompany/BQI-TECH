"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gift, Bell, Search, Eye, FileText } from "lucide-react";

interface TipsAndShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TipsAndShortcuts({ isOpen, onClose }: TipsAndShortcutsProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-800">
            <Gift className="h-5 w-5" />
            Tips & Shortcuts
          </DialogTitle>
          <DialogDescription>
            Helpful tips to make your email campaigns more effective
          </DialogDescription>
        </DialogHeader>

        <Card className="border-0 shadow-none bg-gradient-to-br from-yellow-50 to-orange-50">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-start gap-2">
              <Bell className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-sm text-orange-700">
                <strong>Pro Tip:</strong> Use AI generation for personalized
                content that resonates with your audience.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Search className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-sm text-orange-700">
                <strong>Search:</strong> Find specific users by name or email to
                target your campaigns.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Eye className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-sm text-orange-700">
                <strong>Preview:</strong> Always preview your emails before
                sending to ensure proper formatting.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-sm text-orange-700">
                <strong>Templates:</strong> Save time with pre-built templates
                for common email types.
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
