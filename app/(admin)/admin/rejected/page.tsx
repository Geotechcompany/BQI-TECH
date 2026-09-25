"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { publicAdminHref } from '@/lib/admin-path';

export default function RejectedPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to disqualified page
    router.replace(publicAdminHref('/manage/disqualified'));
  }, [router]);

  return null;
}
