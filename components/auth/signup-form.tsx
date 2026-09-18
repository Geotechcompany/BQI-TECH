"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import {
  criticallyDampedSpring,
  portalAuthAutofillCss,
  portalAuthButtonClass,
  portalAuthInputClass,
  portalAuthLabelClass,
  portalAuthLinkClass,
} from "@/components/auth/portal-auth-styles";
import { cn } from "@/lib/utils";

const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormData = z.infer<typeof signupSchema>;

interface SignupFormProps {
  onSignup: (email: string, password: string, name: string) => Promise<void>;
}

export function SignupForm({ onSignup }: SignupFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const reduceMotion = useReducedMotion();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: FormData) => {
    await onSignup(data.email, data.password, data.name);
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
    <div className="space-y-7">
      <motion.div {...fadeUp(0.05)} className="space-y-2 text-center">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-[#1d1d1f] sm:text-[2rem]">
          Create an Account
        </h1>
        <p className="text-[15px] leading-relaxed text-[#6e6e73]">
          Enter your information to create your account
        </p>
      </motion.div>

      <style>{portalAuthAutofillCss}</style>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="portal-auth-form space-y-4"
      >
        <motion.div {...fadeUp(0.08)} className="space-y-2">
          <Label htmlFor="name" className={portalAuthLabelClass}>
            Full Name
          </Label>
          <Input
            id="name"
            placeholder="Enter your full name"
            type="text"
            autoComplete="name"
            disabled={isSubmitting}
            {...register("name")}
            className={portalAuthInputClass}
          />
          {errors.name?.message && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </motion.div>

        <motion.div {...fadeUp(0.12)} className="space-y-2">
          <Label htmlFor="email" className={portalAuthLabelClass}>
            Email
          </Label>
          <Input
            id="email"
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            disabled={isSubmitting}
            {...register("email")}
            className={portalAuthInputClass}
          />
          {errors.email?.message && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </motion.div>

        <motion.div {...fadeUp(0.16)} className="space-y-2">
          <Label htmlFor="password" className={portalAuthLabelClass}>
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              placeholder="Create a password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register("password")}
              className={cn(portalAuthInputClass, "pr-11")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-[#86868b] transition-colors hover:text-[#1d1d1f]"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password?.message && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </motion.div>

        <motion.div {...fadeUp(0.2)} className="space-y-2">
          <Label htmlFor="confirmPassword" className={portalAuthLabelClass}>
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              placeholder="Re-enter your password"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register("confirmPassword")}
              className={cn(portalAuthInputClass, "pr-11")}
            />
            <button
              type="button"
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-[#86868b] transition-colors hover:text-[#1d1d1f]"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword?.message && (
            <p className="text-sm text-red-500">
              {errors.confirmPassword.message}
            </p>
          )}
        </motion.div>

        <motion.div {...fadeUp(0.24)}>
          <Button
            type="submit"
            className={portalAuthButtonClass}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </motion.div>
      </form>

      <motion.div
        {...fadeUp(0.3)}
        className="text-center text-sm text-[#6e6e73]"
      >
        Already have an account?{" "}
        <Link href="/login" className={portalAuthLinkClass}>
          Sign in
        </Link>
      </motion.div>
    </div>
  );
}
