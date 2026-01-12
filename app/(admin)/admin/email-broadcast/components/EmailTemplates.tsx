"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Eye,
  UserPlus,
  Bell,
  Gift,
  TrendingUp,
  Calendar,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import React from "react";

interface EmailTemplatesProps {
  onTemplateSelect: (template: any) => void;
  onTemplatePreview: (template: any) => void;
}

export function EmailTemplates({
  onTemplateSelect,
  onTemplatePreview,
}: EmailTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Default header and footer components
  const getDefaultHeader = () => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://bqitech.com";
    return `
      <div style="background: linear-gradient(135deg, #272055 0%, #31CDFF 100%); padding: 30px 20px; text-align: center; margin-bottom: 30px;">
        <img src="${baseUrl}/bqilogo-light.png" alt="BQI Tech Logo" style="max-width: 180px; height: auto; margin-bottom: 15px;">
        <div style="color: white; font-size: 14px; opacity: 0.9;">bqitech.com</div>
      </div>
    `;
  };

  const getDefaultFooter = () => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://bqitech.com";
    return `
      <div style="background-color: #f8f9fa; padding: 30px 20px; text-align: center; margin-top: 40px; border-top: 3px solid #31CDFF;">
        <div style="margin-bottom: 20px;">
          <img src="${baseUrl}/bqilogo-light.png" alt="BQI Tech Logo" style="max-width: 120px; height: auto; opacity: 0.8;">
        </div>
        <div style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 15px;">
          <strong>BQI Technologies</strong><br>
          Empowering businesses through innovative technology solutions
        </div>
        <div style="color: #999; font-size: 12px; margin-bottom: 20px;">
          Visit us at <a href="https://bqitech.com" style="color: #31CDFF; text-decoration: none;">bqitech.com</a>
        </div>
        <div style="color: #999; font-size: 12px;">
          Best regards,<br>
          <strong>The BQI Tech Team</strong>
        </div>
      </div>
    `;
  };

  const emailTemplates = [
    {
      id: "welcome",
      name: "Welcome Email",
      subject: "Welcome to BQI Tech!",
      body: `${getDefaultHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 0 20px;">
          <h1 style="color: #272055; text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: 600;">Welcome to BQI Tech!</h1>
          <p style="font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 25px; text-align: center;">We're excited to have you join our team. This email contains important information about your new role and next steps.</p>
          
          <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #31CDFF;">
            <h3 style="color: #272055; margin-bottom: 20px; font-size: 20px; font-weight: 600;">🚀 Next Steps</h3>
            <ul style="color: #333; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Complete your employee onboarding forms</li>
              <li style="margin-bottom: 8px;">Attend the orientation session on [Date]</li>
              <li style="margin-bottom: 8px;">Meet with your direct supervisor</li>
              <li style="margin-bottom: 8px;">Set up your work station and access</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; line-height: 1.7; color: #333; text-align: center; margin: 30px 0;">If you have any questions, please don't hesitate to reach out to our HR team.</p>
          <p style="font-size: 16px; line-height: 1.7; color: #333; text-align: center; font-weight: 600;">Welcome aboard!</p>
        </div>
        ${getDefaultFooter()}`,
      icon: UserPlus,
      color: "bg-green-100 text-green-700",
    },
    {
      id: "newsletter",
      name: "Newsletter",
      subject: "BQI Tech Monthly Newsletter - [Month Year]",
      body: `${getDefaultHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 0 20px;">
          <h1 style="color: #272055; text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: 600;">Monthly Newsletter</h1>
          <p style="font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 25px; text-align: center;">Stay updated with the latest news and developments at BQI Tech.</p>
          
          <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #31CDFF;">
            <h3 style="color: #272055; margin-bottom: 20px; font-size: 20px; font-weight: 600;">📈 This Month's Highlights</h3>
            <ul style="color: #333; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">New project launches and achievements</li>
              <li style="margin-bottom: 8px;">Team updates and new hires</li>
              <li style="margin-bottom: 8px;">Upcoming events and training sessions</li>
              <li style="margin-bottom: 8px;">Company milestones and recognitions</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; line-height: 1.7; color: #333; text-align: center; margin: 30px 0;">Thank you for being part of our amazing team!</p>
        </div>
        ${getDefaultFooter()}`,
      icon: Bell,
      color: "bg-blue-100 text-blue-700",
    },
    {
      id: "promotion",
      name: "Promotional Offer",
      subject: "Special Offer - Limited Time Only!",
      body: `${getDefaultHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 0 20px;">
          <h1 style="color: #272055; text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: 600;">Special Offer Inside!</h1>
          <p style="font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 25px; text-align: center;">Don't miss out on this exclusive opportunity for our valued team members.</p>
          
          <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 2px solid #ffc107; padding: 30px; border-radius: 12px; margin: 25px 0; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h3 style="color: #856404; margin-bottom: 20px; font-size: 24px; font-weight: 600;">🎉 Limited Time Offer</h3>
            <p style="font-size: 20px; color: #856404; font-weight: bold; margin-bottom: 10px;">Get [Offer Details] at a special discount!</p>
            <p style="color: #856404; font-size: 16px; font-weight: 600;">Valid until [End Date]</p>
          </div>
          
          <p style="font-size: 16px; line-height: 1.7; color: #333; text-align: center; margin: 30px 0; font-weight: 600;">Act now to take advantage of this amazing deal!</p>
        </div>
        ${getDefaultFooter()}`,
      icon: Gift,
      color: "bg-yellow-100 text-yellow-700",
    },
    {
      id: "announcement",
      name: "Company Announcement",
      subject: "Important Company Update",
      body: `${getDefaultHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 0 20px;">
          <h1 style="color: #272055; text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: 600;">Important Announcement</h1>
          <p style="font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 25px; text-align: center;">We have an important update to share with all team members.</p>
          
          <div style="background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%); border-left: 4px solid #31CDFF; padding: 25px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <h3 style="color: #272055; margin-bottom: 20px; font-size: 20px; font-weight: 600;">📢 Update Details</h3>
            <p style="color: #333; line-height: 1.8; margin: 0;">[Insert your announcement details here]</p>
          </div>
          
          <p style="font-size: 16px; line-height: 1.7; color: #333; text-align: center; margin: 30px 0;">Please review this information carefully and reach out if you have any questions.</p>
        </div>
        ${getDefaultFooter()}`,
      icon: TrendingUp,
      color: "bg-purple-100 text-purple-700",
    },
    {
      id: "event",
      name: "Event Invitation",
      subject: "You're Invited: [Event Name]",
      body: `${getDefaultHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 0 20px;">
          <h1 style="color: #272055; text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: 600;">You're Invited!</h1>
          <p style="font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 25px; text-align: center;">Join us for an exciting event that you won't want to miss.</p>
          
          <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 30px; border-radius: 12px; margin: 25px 0; text-align: center; border: 2px solid #31CDFF;">
            <h3 style="color: #272055; margin-bottom: 25px; font-size: 20px; font-weight: 600;">📅 Event Details</h3>
            <p style="font-size: 22px; color: #333; font-weight: bold; margin-bottom: 20px;">[Event Name]</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #333; margin: 10px 0; font-size: 16px;">📅 <strong>Date:</strong> [Event Date]</p>
              <p style="color: #333; margin: 10px 0; font-size: 16px;">🕐 <strong>Time:</strong> [Event Time]</p>
              <p style="color: #333; margin: 10px 0; font-size: 16px;">📍 <strong>Location:</strong> [Event Location]</p>
            </div>
          </div>
          
          <p style="font-size: 16px; line-height: 1.7; color: #333; text-align: center; margin: 30px 0; font-weight: 600;">We look forward to seeing you there!</p>
        </div>
        ${getDefaultFooter()}`,
      icon: Calendar,
      color: "bg-orange-100 text-orange-700",
    },
    {
      id: "survey",
      name: "Survey Request",
      subject: "Your Feedback Matters: BQI Tech Company Survey",
      body: `${getDefaultHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 0 20px;">
          <h1 style="color: #272055; text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: 600;">Your Feedback Matters</h1>
          
          <p style="font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 20px;">Dear valued user,</p>
          
          <p style="font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 20px;">We hope this email finds you well. At BQI Tech, we are committed to continuously improving our services and products to meet your evolving needs. To help us achieve this goal, we kindly request that you take a few minutes to complete our company survey.</p>
          
          <p style="font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 20px;">Your feedback is invaluable in shaping our future direction and ensuring that we deliver the best possible experience for you. The survey consists of only 5-7 minutes of your time and can be accessed via the link below.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="display: inline-block; background: linear-gradient(135deg, #31CDFF 0%, #272055 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Take the Survey Now</a>
          </div>
          
          <p style="font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 20px;">Thank you in advance for your participation and feedback! If you have any questions or concerns, please do not hesitate to contact us.</p>
          
          <p style="font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 10px;">Best regards,</p>
          <p style="font-size: 16px; line-height: 1.7; color: #333; font-weight: 600;">The BQI Tech Team</p>
        </div>
        ${getDefaultFooter()}`,
      icon: BarChart3,
      color: "bg-indigo-100 text-indigo-700",
    },
  ];

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template.id);
    onTemplateSelect(template);
    toast.success(`${template.name} template applied`);
  };

  const handleTemplatePreview = (template: any) => {
    onTemplatePreview(template);
  };

  return (
    <Card className="border-2 border-gray-200 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Email Templates
        </CardTitle>
        <CardDescription>Choose from prebuilt templates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {emailTemplates.map((template) => {
            const IconComponent = template.icon;
            return (
              <Card
                key={template.id}
                className={`p-4 border-2 transition-all duration-200 hover:shadow-md ${
                  selectedTemplate === template.id
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${template.color}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {template.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {template.subject}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTemplatePreview(template)}
                      className="text-gray-600 hover:text-blue-600 hover:border-blue-300"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleTemplateSelect(template)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Use
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
