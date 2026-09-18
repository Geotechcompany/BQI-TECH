"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/lib/auth-backend';
import { BACKEND_URL } from '@/lib/config';
import { resolveEmailVerified } from '@/lib/resolve-email-verified';
import { PremiumDashboardLoader } from '@/components/admin/PremiumDashboardLoader';

interface EmailVerificationGuardProps {
  children: React.ReactNode;
  requireVerification?: boolean;
}

// Paths that don't require email verification
const noVerificationPaths = [
  '/auth/verify-email',
  '/login',
  '/admin/login',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/logout'
];

export function EmailVerificationGuard({ 
  children, 
  requireVerification = true 
}: EmailVerificationGuardProps) {
  const { user, isAuthenticated, authLoading, isEmailVerified, updateEmailVerificationStatus } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkVerification = async () => {
      // Skip verification check if disabled or on exempt paths
      if (!requireVerification || noVerificationPaths.some(path => pathname.startsWith(path))) {
        setIsChecking(false);
        return;
      }

      // Wait for auth to load
      if (authLoading) {
        return;
      }

      // If user is not authenticated, let other auth guards handle it
      if (!isAuthenticated || !user) {
        setIsChecking(false);
        return;
      }

      // Prevent multiple redirects by checking current path and using a flag
      const hasRedirectedKey = 'emailVerificationRedirected';
      const hasRedirectedBefore = localStorage.getItem(hasRedirectedKey);

      // Refresh profile / server status before redirecting
      let verified = isEmailVerified();
      if (!verified) {
        const refreshed = await authService.refreshUserProfile();
        verified = resolveEmailVerified(
          refreshed?.user?.isEmailVerified,
          verified
        );
      }

      if (!verified && user.email) {
        try {
          const statusResponse = await fetch(
            `${BACKEND_URL}/api/auth/verify-email/status`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(user.email),
            }
          );
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            verified = resolveEmailVerified(statusData?.isEmailVerified, verified);
            if (verified) {
              await updateEmailVerificationStatus(true);
            }
          }
        } catch (error) {
          console.error("Failed to confirm email verification status:", error);
        }
      }

      // Only redirect if not already on verification page and not redirected recently
      if (!verified &&
          !pathname.startsWith('/auth/verify-email') && 
          !hasRedirectedBefore) {
        
        // Set a flag to prevent multiple redirects
        localStorage.setItem(hasRedirectedKey, 'true');
        
        // Clear the flag after a short delay
        setTimeout(() => {
          localStorage.removeItem(hasRedirectedKey);
        }, 5000);

        const verifyUrl = `/auth/verify-email?email=${encodeURIComponent(user.email)}`;
        router.push(verifyUrl);
        return;
      }

      setIsChecking(false);
    };

    checkVerification();
  }, [
    isAuthenticated, 
    user, 
    authLoading, 
    pathname, 
    requireVerification, 
    isEmailVerified, 
    updateEmailVerificationStatus,
    router
  ]);

  // Show loading screen while checking verification
  if (isChecking || authLoading) {
    return <PremiumDashboardLoader />;
  }

  // If we reach here, verification passed or is not required
  return <>{children}</>;
} 