"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { authService } from "@/lib/auth-backend";
import type { BlogWizardState } from "@/types/blog-wizard";
import {
  blogPostToWizardState,
  createEmptyBlogWizardState,
  wizardStateToBlogPayload,
} from "./blog-wizard-config";

const API_BASE = process.env.NEXT_PUBLIC_PYTHON_API_URL;

export interface FinishBlogWizardResult {
  postId: string;
  title: string;
  published: boolean;
  slug: string;
}

async function authFetch(url: string, options: RequestInit = {}) {
  const session = authService.getSession();
  if (!session) throw new Error("No authentication session");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
    Accept: "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  let response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  if (response.status === 401) {
    const refreshed = await authService.refreshToken();
    if (!refreshed) throw new Error("Session expired");
    response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...headers,
        Authorization: `Bearer ${refreshed.access_token}`,
      },
    });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body?.detail;
    if (typeof detail === "string" && detail.trim()) {
      throw new Error(detail);
    }
    throw new Error(body?.message || "Request failed");
  }

  return response.json();
}

export function useBlogWizard(postId?: string) {
  const router = useRouter();
  const [state, setState] = useState<BlogWizardState>(createEmptyBlogWizardState);
  const [savedPostId, setSavedPostId] = useState<string | undefined>(postId);
  const [loadedPublished, setLoadedPublished] = useState<boolean | null>(
    postId ? null : false
  );
  const [isLoading, setIsLoading] = useState(Boolean(postId));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!postId) return;

    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const post = await authFetch(
          `${API_BASE}/api/admin/blog-posts/${postId}`
        );
        if (cancelled) return;
        const next = blogPostToWizardState(post);
        setState(next);
        setLoadedPublished(next.published);
        setSavedPostId(postId);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load blog post");
        router.push("/admin/blog-management");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [postId, router]);

  const persistPost = useCallback(
    async (wizardState: BlogWizardState, options?: { forceDraft?: boolean }) => {
      const payload = wizardStateToBlogPayload(wizardState, options);
      const targetId = savedPostId;

      if (targetId) {
        await authFetch(`${API_BASE}/api/admin/blog-posts/${targetId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        return { id: targetId, ...payload };
      }

      const created = await authFetch(`${API_BASE}/api/admin/blog-posts`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const newId = String(created.id || created._id);
      setSavedPostId(newId);
      return created;
    },
    [savedPostId]
  );

  const saveProgress = useCallback(async () => {
    setIsSaving(true);
    try {
      // Mid-wizard saves stay draft unless this post was already live when opened.
      const forceDraft = loadedPublished !== true;
      const result = await persistPost(state, { forceDraft });
      const targetId = savedPostId || String(result.id || result._id);
      toast.success("Draft saved");
      return targetId;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to save");
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [loadedPublished, persistPost, savedPostId, state]);

  const finishWizard = useCallback(async (): Promise<FinishBlogWizardResult> => {
    setIsSaving(true);
    try {
      const result = await persistPost(state);
      const targetId = savedPostId || String(result.id || result._id);
      const slug =
        state.slug.trim() ||
        String(result.slug || "");
      setLoadedPublished(state.published);
      return {
        postId: targetId,
        title: state.title,
        published: state.published,
        slug,
      };
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save blog post"
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [persistPost, savedPostId, state]);

  return {
    state,
    setState,
    savedPostId,
    isLoading,
    isSaving,
    saveProgress,
    finishWizard,
  };
}
