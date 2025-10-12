"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { userApi } from "@/lib/api-backend";
import { toast } from "sonner";

interface SessionTimeoutModalProps {
  isOpen: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
  timeRemaining: number;
  totalTime: number;
}

export function SessionTimeoutModal({
  isOpen,
  onStayLoggedIn,
  onLogout,
  timeRemaining,
  totalTime,
}: SessionTimeoutModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    setMinutes(mins);
    setSeconds(secs);
  }, [timeRemaining]);

  const handleStayLoggedIn = async () => {
    setIsRefreshing(true);
    try {
      // Refresh the session by making an authenticated request
      await userApi.getProfile();
      toast.success("Session refreshed successfully!");
      onStayLoggedIn();
    } catch (error) {
      console.error("Failed to refresh session:", error);
      toast.error("Failed to refresh session. Please log in again.");
      onLogout();
    } finally {
      setIsRefreshing(false);
    }
  };

  const progressPercentage =
    totalTime > 0 ? ((totalTime - timeRemaining) / totalTime) * 100 : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-md mx-4"
          >
            <Card className="border-2 border-orange-200 shadow-2xl">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-3 bg-orange-100 rounded-full w-fit">
                  <Clock className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Session Timeout Warning
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Your session will expire soon. Click "Stay Logged In" to
                  continue.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Timer Display */}
                <div className="text-center">
                  <div className="text-4xl font-mono font-bold text-orange-600 mb-2">
                    {minutes.toString().padStart(2, "0")}:
                    {seconds.toString().padStart(2, "0")}
                  </div>
                  <p className="text-sm text-gray-500">Time remaining</p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <Progress
                    value={progressPercentage}
                    className="h-2 bg-gray-200"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Session started</span>
                    <span>Expires soon</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleStayLoggedIn}
                    disabled={isRefreshing}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isRefreshing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Stay Logged In
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={onLogout}
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>

                <p className="text-xs text-center text-gray-500">
                  Your session will automatically expire if no action is taken.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
