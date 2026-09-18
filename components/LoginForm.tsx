"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  criticallyDampedSpring,
  portalAuthAutofillCss,
  portalAuthButtonClass,
  portalAuthInputClass,
  portalAuthLabelClass,
  portalAuthLinkClass,
} from "@/components/auth/portal-auth-styles";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormData = z.infer<typeof formSchema>;

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onError: (error: unknown) => void;
}

function LoginForm({ onLogin, onError }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const reduceMotion = useReducedMotion();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true);
      await onLogin(data.email, data.password);
    } catch (error) {
      onError(error);
    } finally {
      setIsLoading(false);
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
    <div className="space-y-7">
      <motion.div {...fadeUp(0.05)} className="space-y-2 text-center">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-[#1d1d1f] sm:text-[2rem]">
          Welcome Back
        </h1>
        <p className="text-[15px] leading-relaxed text-[#6e6e73]">
          Enter your credentials to access your account
        </p>
      </motion.div>

      <style>{portalAuthAutofillCss}</style>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="portal-auth-form space-y-4"
      >
        <motion.div {...fadeUp(0.1)} className="space-y-2">
          <Label htmlFor="email" className={portalAuthLabelClass}>
            Email
          </Label>
          <Input
            id="email"
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            disabled={isLoading}
            {...register("email")}
            className={portalAuthInputClass}
          />
          {errors.email?.message && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </motion.div>

        <motion.div {...fadeUp(0.14)} className="space-y-2">
          <Label htmlFor="password" className={portalAuthLabelClass}>
            Password
          </Label>
          <Input
            id="password"
            placeholder="Enter your password"
            type="password"
            autoComplete="current-password"
            disabled={isLoading}
            {...register("password")}
            className={portalAuthInputClass}
          />
          {errors.password?.message && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </motion.div>

        <motion.div
          {...fadeUp(0.18)}
          className="flex items-center justify-end pt-0.5"
        >
          <Link href="/forgot-password" className={`text-sm ${portalAuthLinkClass}`}>
            Forgot password?
          </Link>
        </motion.div>

        <motion.div {...fadeUp(0.22)}>
          <Button
            type="submit"
            className={portalAuthButtonClass}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </motion.div>
      </form>

      <motion.div
        {...fadeUp(0.28)}
        className="text-center text-sm text-[#6e6e73]"
      >
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className={portalAuthLinkClass}>
          Sign up
        </Link>
      </motion.div>
    </div>
  );
}

export { LoginForm };
