"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JobPosting } from "@/types/jobPosting";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { Editor } from "@/components/editor";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

// Remove ReactQuill in favor of TipTap-based Editor used across the app
import Loader from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth-backend";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { FormSkeleton } from "@/components/ui/skeleton";

export default function EditJobPostingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, isAdmin, authLoading } = useAuth();
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    async function fetchJobPosting() {
      // Validate id parameter
      if (!id) {
        setError("Invalid job ID");
        setIsFetching(false);
        return;
      }

      if (id === "new") {
        const initialJobPosting: JobPosting = {
          _id: "",
          id: "",
          title: "",
          department: "",
          location: "",
          description: "",
          postedDate: new Date().toISOString(),
          employmentType: "Full-time",
          category: "",
          questions: [],
          isActive: true,
        };
        setJobPosting(initialJobPosting);
        setIsFetching(false);
        return;
      }

      try {
        const session = authService.getSession();
        if (!session) {
          router.push('/login');
          setIsFetching(false);
          return;
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/admin/job-postings/${id}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
            'Accept': 'application/json'
          }
        });

        if (response.status === 401) {
          const refreshed = await authService.refreshToken();
          if (!refreshed) {
            router.push('/login');
            return;
          }

          const retryResponse = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/admin/job-postings/${id}`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${refreshed.access_token}`,
              'Accept': 'application/json'
            }
          });

          if (!retryResponse.ok) {
            throw new Error("Failed to fetch job posting");
          }
          const retryData = await retryResponse.json();
          setJobPosting(retryData);
          setIsFetching(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch job posting");
        }
        const data = await response.json();
        setJobPosting(data);
        setIsFetching(false);
      } catch (err) {
        setError("Failed to load job posting. Please try again.");
        setIsFetching(false);
      }
    }

    fetchJobPosting();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setJobPosting((prev) => ({ ...prev!, [name]: value }));
  };

  const handleDescriptionChange = (value: string) => {
    if (jobPosting) {
      // Clean up HTML entities and normalize spaces
      const cleanedValue = value
        .replace(/&nbsp;/g, ' ')  // Replace &nbsp; with regular space
        .replace(/\s+/g, ' ')     // Normalize multiple spaces
        .trim();                  // Trim extra spaces
      
      setJobPosting((prev) => ({ ...prev!, description: cleanedValue }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobPosting) return;

    // Custom validation
    if (!jobPosting.title || !jobPosting.department || !jobPosting.location || !jobPosting.description) {
      toast.error("Please fill in all fields.");
      return;
    }

    setIsLoading(true); // Set loading state

    try {
      const session = authService.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const baseUrl = `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/admin/job-postings`;
      const url = id === "new" ? baseUrl : `${baseUrl}/${id}`;
      const method = id === "new" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(jobPosting),
      });

      if (response.status === 401) {
        const refreshed = await authService.refreshToken();
        if (!refreshed) {
          router.push('/login');
          return;
        }

        const retryResponse = await fetch(url, {
          method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${refreshed.access_token}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify(jobPosting),
        });

        if (!retryResponse.ok) {
          throw new Error("Failed to save job posting");
        }
      } else if (!response.ok) {
        throw new Error("Failed to save job posting");
      }

      toast.success("Job posting saved successfully!");
      router.push("/admin/job-postings");
    } catch (err) {
      setError("Failed to save job posting. Please try again.");
      toast.error("Failed to save job posting. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isFetching) {
    return (
      <AdminPageLayout title={id === "new" ? "Add New Job Posting" : "Edit Job Posting"} showSearch={false}>
        <div className="max-w-2xl mx-auto">
          <FormSkeleton />
        </div>
      </AdminPageLayout>
    );
  }

  if (error) {
    return (
      <AdminPageLayout title="Error" showSearch={false}>
        <div className="text-destructive">{error}</div>
      </AdminPageLayout>
    );
  }

  if (!jobPosting) {
    return (
      <AdminPageLayout title={id === "new" ? "Add New Job Posting" : "Edit Job Posting"} showSearch={false}>
        <div className="max-w-2xl mx-auto">
          <FormSkeleton />
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout title={id === "new" ? "Add New Job Posting" : "Edit Job Posting"} showSearch={false}>
      <div className="max-w-2xl mx-auto">
        <div className="p-6 rounded-lg border bg-card text-foreground">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                name="title"
                value={jobPosting.title}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Employment Type</Label>
                <Select
                  value={jobPosting.employmentType || "Full-time"}
                  onValueChange={(v) => setJobPosting((prev) => ({ ...prev!, employmentType: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Internship">Internship</SelectItem>
                    <SelectItem value="Temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Posted Date</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={(jobPosting.postedDate || new Date().toISOString()).slice(0, 10)}
                  onChange={(e) => setJobPosting((prev) => ({ ...prev!, postedDate: new Date(e.target.value).toISOString() }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                name="department"
                value={jobPosting.department}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                value={jobPosting.location}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="description">Job Description</Label>
              <div className="mt-1 rounded-md border bg-background" id="description">
                <Editor
                  value={jobPosting.description}
                  onChange={handleDescriptionChange}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Job Posting"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AdminPageLayout>
  );
}
