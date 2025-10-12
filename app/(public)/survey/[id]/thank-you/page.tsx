"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function SurveyThankYouPage() {
  const params = useParams<{ id: string }>();
  const surveyId = params.id;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="max-w-xl w-full p-8 text-center shadow-md border border-[#31CDFF]/20 bg-gradient-to-br from-[#31CDFF]/5 to-transparent">
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-[#272055] to-[#31CDFF] text-transparent bg-clip-text">
          Thank you!
        </h1>
        <p className="text-muted-foreground mb-6">
          Your response has been recorded. We appreciate your time and feedback.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/">
            <Button variant="outline">Go to Home</Button>
          </Link>
          <Link href={`/survey/${surveyId}`}>
            <Button>Back to Survey</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
