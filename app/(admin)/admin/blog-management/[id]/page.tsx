"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { BlogPostForm } from "@/components/admin/BlogPostForm"
import { AdminPageLayout } from "@/components/admin/AdminPageLayout"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormSkeleton } from "@/components/ui/skeleton"
import type { BlogPost } from "@/types/blog"
import { useEffect } from "react"

export default function BlogPostEditor() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : null
  const isNew = id === "new"

  const { data: blogPost, isLoading, error } = useQuery({
    queryKey: ['blog-post', id],
    queryFn: async () => {
      if (isNew || !id) return null
      const res = await fetch(`/api/admin/blog-posts/${id}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to fetch post')
      }
      const data = await res.json()
      return data as BlogPost
    },
    enabled: !isNew && !!id,
    retry: 2,
    staleTime: 1000 * 60 * 5
  })

  const handleSubmit = async (data: Partial<BlogPost>) => {
    try {
      if (!isNew && !id) {
        throw new Error('Blog post ID is required for updates')
      }

      const url = isNew ? "/api/admin/blog-posts" : `/api/admin/blog-posts/${id}`
      const method = isNew ? "POST" : "PATCH"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to save blog post")
      }

      toast.success("Blog post saved successfully")
      router.push(publicAdminHref("/manage/blog-management"))
      router.refresh()
    } catch (error) {
      console.error('Save error:', error)
      toast.error(error instanceof Error ? error.message : "Failed to save blog post")
    }
  }

  useEffect(() => {
    if (id === "new") {
      router.replace(publicAdminHref("/manage/blog-management/wizard"))
    } else {
      router.replace(publicAdminHref(`/manage/blog-management/${id}/view`))
    }
  }, [id, router])

  // Handle invalid ID parameter
  if (!isNew && !id) {
    return (
      <AdminPageLayout title="Error">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-4">Invalid blog post ID</h2>
          <Button onClick={() => router.push(publicAdminHref('/manage/blog-management'))}>
            Back to Posts
          </Button>
        </div>
      </AdminPageLayout>
    )
  }

  if (!isNew && error) {
    return (
      <AdminPageLayout title="Error">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-4">Failed to load blog post</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
          <Button onClick={() => router.push(publicAdminHref('/manage/blog-management'))}>
            Back to Posts
          </Button>
        </div>
      </AdminPageLayout>
    )
  }

  if (!isNew && isLoading) {
    return (
      <AdminPageLayout title="Edit Blog Post">
        <div className="max-w-4xl p-6">
          <FormSkeleton />
        </div>
      </AdminPageLayout>
    )
  }

  if (!isNew && !blogPost) {
    return (
      <AdminPageLayout title="Not Found">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-4">Post not found</h2>
          <Button onClick={() => router.push(publicAdminHref('/manage/blog-management'))}>
            Back to Posts
          </Button>
        </div>
      </AdminPageLayout>
    )
  }

  return (
    <AdminPageLayout title={isNew ? "Create Blog Post" : "Edit Blog Post"}>
      <div className="h-full space-y-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => router.push(publicAdminHref('/manage/blog-management'))}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blog Posts
          </Button>
        </div>

        <div className="max-w-4xl bg-white dark:bg-gray-800 rounded-lg p-6">
          <BlogPostForm 
            initialData={blogPost} 
            onSubmit={handleSubmit} 
          />
        </div>
      </div>
    </AdminPageLayout>
  )
} 
import { publicAdminHref } from "@/lib/admin-path";