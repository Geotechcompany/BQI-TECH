"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Zap } from "lucide-react";
import { FieldError } from "react-hook-form";
import toast from "react-hot-toast";
import Link from "next/link";

const formSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function ResetPasswordPage() {
  const [isValidToken, setIsValidToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch(
          `${
            process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:9000"
          }/api/auth/validate-reset-token?token=${token}`
        );
        if (!response.ok) throw new Error("Invalid or expired token");
        setIsValidToken(true);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) validateToken();
  }, [token]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:9000"
        }/api/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password: data.password }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        const detail = errorData.detail;
        const message =
          typeof detail === "string"
            ? detail
            : detail?.message || "Password reset failed";
        throw new Error(message);
      }

      toast.success("Password updated successfully!", {
        description: "You can now sign in with your new password.",
      });
      // Redirect to login after 2 seconds
      setTimeout(() => (window.location.href = "/login?passwordReset=1"), 2000);
    } catch (error) {
      toast.error(error.message || "Failed to reset password");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:block relative bg-gradient-to-br from-[#31CDFF] to-blue-600">
          <div className="absolute inset-0 pattern-dots pattern-blue-500 pattern-bg-transparent pattern-opacity-20 pattern-size-4" />
          <div className="relative h-full flex flex-col justify-between p-12 text-white">
            <Zap className="w-12 h-12" />
            <div className="space-y-4">
              <h2 className="text-4xl font-bold">BQI Tech Portal</h2>
              <p className="text-lg opacity-90">
                Secure account recovery process
              </p>
            </div>
            <div className="flex gap-4 opacity-75">
              <span className="text-sm">v2.4.0</span>
              <span className="text-sm">•</span>
              <span className="text-sm">Enterprise Security</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center p-8 bg-background">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const RightPanelWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center justify-center p-8 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 bg-background p-8 rounded-lg shadow-2xl w-full max-w-md"
      >
        <Link
          href="/login"
          className="flex items-center text-sm text-[#31CDFF] hover:text-[#31CDFF]/90 mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to login
        </Link>
        {children}
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Gradient Background */}
      <div className="hidden lg:block relative bg-gradient-to-br from-[#31CDFF] to-blue-600">
        <div className="absolute inset-0 pattern-dots pattern-blue-500 pattern-bg-transparent pattern-opacity-20 pattern-size-4" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <Zap className="w-12 h-12" />
          <div className="space-y-4">
            <h2 className="text-4xl font-bold">BQI Tech Portal</h2>
            <p className="text-lg opacity-90">
              Secure account recovery process
            </p>
          </div>
          <div className="flex gap-4 opacity-75">
            <span className="text-sm">v2.4.0</span>
            <span className="text-sm">•</span>
            <span className="text-sm">Enterprise Security</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Reset Form or Invalid Token Message */}
      <RightPanelWrapper>
        {isValidToken ? (
          <>
            <div className="text-center space-y-2 mb-8">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold"
              >
                Reset Password
              </motion.h1>
              <p className="text-muted-foreground">Enter your new password</p>
            </div>

            <motion.form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    {...register("password")}
                    className="h-12 focus:ring-2 focus:ring-[#31CDFF]"
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500">
                      {(errors.password as FieldError).message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...register("confirmPassword")}
                    className="h-12 focus:ring-2 focus:ring-[#31CDFF]"
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500">
                      {(errors.confirmPassword as FieldError).message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-gradient-to-r from-[#31CDFF] to-blue-500 hover:from-[#31CDFF]/90 hover:to-blue-500/90"
                >
                  Reset Password
                </Button>
              </div>
            </motion.form>
          </>
        ) : (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Invalid Token</h1>
            <p className="text-muted-foreground">
              The password reset link is invalid or has expired
            </p>
            <Link
              href="/forgot-password"
              className="text-[#31CDFF] hover:underline"
            >
              Request new reset link
            </Link>
          </div>
        )}
      </RightPanelWrapper>
    </div>
  );
}
