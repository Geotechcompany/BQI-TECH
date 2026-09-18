"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Editor } from "@/components/editor";
import { Badge } from "@/components/ui/badge";
import { GenerateButton } from "@/components/ui/generate-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BlogWizardState, BlogWizardStepId } from "@/types/blog-wizard";
import { generateBlogSlug } from "./blog-wizard-config";
import { ImageUploadField } from "./ImageUploadField";

interface StepProps {
  state: BlogWizardState;
  onChange: (patch: Partial<BlogWizardState>) => void;
}

export function BasicsStep({ state, onChange }: StepProps) {
  const [tagInput, setTagInput] = useState("");

  const applyTitle = (title: string) => {
    if (state.slugTouched) {
      onChange({ title });
      return;
    }
    onChange({
      title,
      slug: title.trim() ? generateBlogSlug(title) : "",
    });
  };

  const addTag = () => {
    const next = tagInput.trim().toLowerCase();
    if (!next) return;
    if (state.tags.includes(next)) return;
    if (state.tags.length >= 10) return;
    onChange({ tags: [...state.tags, next] });
    setTagInput("");
  };

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="blog-title">Title</Label>
        <Input
          id="blog-title"
          className="mt-1.5"
          value={state.title}
          maxLength={200}
          onChange={(e) => applyTitle(e.target.value)}
          placeholder="Enterprise IT consulting guide"
        />
        <p className="mt-1.5 text-xs text-[#272055]/55">
          {state.title.length}/200
        </p>
      </div>

      <div>
        <Label htmlFor="blog-slug">Slug</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="blog-slug"
            value={state.slug}
            maxLength={200}
            onChange={(e) =>
              onChange({
                slug: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-")
                  .replace(/-+/g, "-"),
                slugTouched: true,
              })
            }
            placeholder="auto-generated-from-title"
          />
          <GenerateButton
            type="button"
            label="Generate"
            generatingLabel="Generating"
            className="text-sm shrink-0"
            onClick={() =>
              onChange({
                slug: generateBlogSlug(state.title),
                slugTouched: true,
              })
            }
          />
        </div>
        <p className="mt-1.5 text-xs text-[#272055]/55">
          Lowercase letters, numbers, and hyphens
        </p>
      </div>

      <div>
        <Label htmlFor="blog-excerpt">Excerpt</Label>
        <Textarea
          id="blog-excerpt"
          className="mt-1.5"
          rows={3}
          maxLength={300}
          value={state.excerpt}
          onChange={(e) => onChange({ excerpt: e.target.value })}
          placeholder="Short summary shown on listing cards"
        />
        <p className="mt-1.5 text-xs text-[#272055]/55">
          {state.excerpt.length}/300
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="blog-category">Category</Label>
          <Input
            id="blog-category"
            className="mt-1.5"
            value={state.category}
            onChange={(e) => onChange({ category: e.target.value })}
            placeholder="Technology, Business…"
          />
        </div>
        <div>
          <Label htmlFor="blog-read-time">Read time</Label>
          <Input
            id="blog-read-time"
            className="mt-1.5"
            value={state.readTime}
            onChange={(e) => onChange({ readTime: e.target.value })}
            placeholder="5 min read"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="blog-tags">Tags</Label>
        <Input
          id="blog-tags"
          className="mt-1.5"
          value={tagInput}
          maxLength={50}
          placeholder="Add a tag and press Enter"
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
        />
        {state.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {state.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  className="rounded-sm p-0.5 hover:bg-[#272055]/10"
                  onClick={() =>
                    onChange({
                      tags: state.tags.filter((item) => item !== tag),
                    })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="mt-1.5 text-xs text-[#272055]/55">
          Up to 10 tags
        </p>
      </div>
    </div>
  );
}

export function ContentStep({ state, onChange }: StepProps) {
  return (
    <div>
      <Label>Body</Label>
      <div className="mt-1.5">
        <Editor
          value={state.content}
          onChange={(content) => onChange({ content })}
        />
      </div>
    </div>
  );
}

export function MediaStep({ state, onChange }: StepProps) {
  return (
    <div className="space-y-8">
      <div>
        <Label>Cover image</Label>
        <div className="mt-1.5">
          <ImageUploadField
            value={state.imageUrl}
            onChange={(imageUrl) => onChange({ imageUrl })}
            placeholder="Upload cover image"
            maxSizeBytes={5 * 1024 * 1024}
          />
        </div>
      </div>

      <div className="border-t border-[#272055]/10 pt-6">
        <h3 className="text-base font-semibold text-[#272055]">Author</h3>
        <p className="mt-1 text-sm text-[#272055]/55">
          Shown on the public post page
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="author-name">Name</Label>
            <Input
              id="author-name"
              className="mt-1.5"
              maxLength={100}
              value={state.authorName}
              onChange={(e) => onChange({ authorName: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label htmlFor="author-title">Title</Label>
            <Input
              id="author-title"
              className="mt-1.5"
              maxLength={100}
              value={state.authorTitle}
              onChange={(e) => onChange({ authorTitle: e.target.value })}
              placeholder="Job title"
            />
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="author-bio">Bio</Label>
          <Textarea
            id="author-bio"
            className="mt-1.5"
            rows={4}
            maxLength={500}
            value={state.authorBio}
            onChange={(e) => onChange({ authorBio: e.target.value })}
            placeholder="Short bio"
          />
          <p className="mt-1.5 text-xs text-[#272055]/55">
            {state.authorBio.length}/500
          </p>
        </div>

        <div className="mt-4">
          <Label>Profile photo</Label>
          <div className="mt-1.5">
            <ImageUploadField
              value={state.authorProfileImage}
              onChange={(authorProfileImage) =>
                onChange({ authorProfileImage })
              }
              placeholder="Upload profile photo"
              maxSizeBytes={10 * 1024 * 1024}
              isCircular
            />
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-medium text-[#272055]">
            Social links (optional)
          </h4>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="author-twitter">Twitter / X</Label>
              <Input
                id="author-twitter"
                className="mt-1.5"
                value={state.authorTwitter}
                onChange={(e) => onChange({ authorTwitter: e.target.value })}
                placeholder="https://x.com/username"
              />
            </div>
            <div>
              <Label htmlFor="author-linkedin">LinkedIn</Label>
              <Input
                id="author-linkedin"
                className="mt-1.5"
                value={state.authorLinkedin}
                onChange={(e) => onChange({ authorLinkedin: e.target.value })}
                placeholder="https://linkedin.com/in/username"
              />
            </div>
            <div>
              <Label htmlFor="author-github">GitHub</Label>
              <Input
                id="author-github"
                className="mt-1.5"
                value={state.authorGithub}
                onChange={(e) => onChange({ authorGithub: e.target.value })}
                placeholder="https://github.com/username"
              />
            </div>
            <div>
              <Label htmlFor="author-website">Website</Label>
              <Input
                id="author-website"
                className="mt-1.5"
                value={state.authorWebsite}
                onChange={(e) => onChange({ authorWebsite: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublishStep({ state, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="meta-description">Meta description (optional)</Label>
        <Textarea
          id="meta-description"
          className="mt-1.5"
          rows={2}
          maxLength={160}
          value={state.metaDescription}
          onChange={(e) => onChange({ metaDescription: e.target.value })}
          placeholder="SEO summary for search results"
        />
        <p className="mt-1.5 text-xs text-[#272055]/55">
          {state.metaDescription.length}/160
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[#272055]/10 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[#272055]">Publish now</p>
          <p className="mt-0.5 text-xs text-[#272055]/55">
            Off keeps this post as a draft
          </p>
        </div>
        <Switch
          checked={state.published}
          onCheckedChange={(published) => onChange({ published })}
        />
      </div>

      <div className="rounded-xl border border-[#272055]/10 bg-white p-5">
        <h3 className="text-sm font-semibold text-[#272055]">Review</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[#272055]/55">Title</dt>
            <dd className="max-w-[60%] text-right font-medium text-[#272055]">
              {state.title.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#272055]/55">Slug</dt>
            <dd className="max-w-[60%] truncate text-right font-medium text-[#272055]">
              {state.slug.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#272055]/55">Category</dt>
            <dd className="font-medium text-[#272055]">
              {state.category.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#272055]/55">Author</dt>
            <dd className="font-medium text-[#272055]">
              {state.authorName.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#272055]/55">Cover</dt>
            <dd className="font-medium text-[#272055]">
              {state.imageUrl ? "Uploaded" : "Missing"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#272055]/55">Status</dt>
            <dd className="font-medium text-[#272055]">
              {state.published ? "Publish on finish" : "Save as draft"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function renderBlogWizardStep(
  step: BlogWizardStepId,
  props: StepProps
) {
  switch (step) {
    case "basics":
      return <BasicsStep {...props} />;
    case "content":
      return <ContentStep {...props} />;
    case "media":
      return <MediaStep {...props} />;
    case "publish":
      return <PublishStep {...props} />;
    default:
      return null;
  }
}
