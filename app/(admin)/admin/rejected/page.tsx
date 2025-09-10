"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RejectedPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to disqualified page
    router.replace('/admin/disqualified');
  }, [router]);

  return null;
}
