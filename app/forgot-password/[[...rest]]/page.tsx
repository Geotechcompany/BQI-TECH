"use client";

import { BACKEND_URL } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { FieldError } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { PortalAuthCard } from "@/components/auth/PortalAuthCard";
import { PortalBrandPanel } from "@/components/auth/PortalBrandPanel";
import {
  criticallyDampedSpring,
  portalAuthAutofillCss,
  portalAuthButtonClass,
  portalAuthInputClass,
  portalAuthLabelClass,
  portalAuthLinkClass,
} from "@/components/auth/portal-auth-styles";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const reduceMotion = useReducedMotion();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to send reset email");
      }

      toast.success("Reset email sent! Check your inbox.");
    } catch (error) {
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fadeUp = (delay: number) =>
    reduceMotion
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 0.28, delay },
        }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { ...criticallyDampedSpring, delay },
        };

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      <PortalBrandPanel
        subtitle="Recover your BQI HR account with a secure email reset link."
        footerLabel="Secure Login"
      />

      <PortalAuthCard backHref="/login" backLabel="Back to login">
        <div className="space-y-7">
          <motion.div {...fadeUp(0.05)} className="space-y-2 text-center">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-[#1d1d1f] sm:text-[2rem]">
              Reset Password
            </h1>
            <p className="text-[15px] leading-relaxed text-[#6e6e73]">
              Enter your email to receive reset instructions
            </p>
          </motion.div>

          <style>{portalAuthAutofillCss}</style>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="portal-auth-form space-y-4"
          >
            <motion.div {...fadeUp(0.1)} className="space-y-2">
              <Label htmlFor="email" className={portalAuthLabelClass}>
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isSubmitting}
                {...register("email")}
                className={portalAuthInputClass}
              />
              {errors.email && (
                <p className="text-sm text-red-500">
                  {(errors.email as FieldError).message}
                </p>
              )}
            </motion.div>

            <motion.div {...fadeUp(0.16)}>
              <Button
                type="submit"
                className={portalAuthButtonClass}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Instructions"
                )}
              </Button>
            </motion.div>
          </form>

          <motion.div
            {...fadeUp(0.22)}
            className="text-center text-sm text-[#6e6e73]"
          >
            Remember your password?{" "}
            <Link href="/login" className={portalAuthLinkClass}>
              Sign in
            </Link>
          </motion.div>
        </div>
      </PortalAuthCard>
    </div>
  );
}
