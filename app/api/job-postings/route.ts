import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const jobPostings = await prisma.jobPosting.findMany({
      orderBy: { postedDate: 'desc' },
    });
    return NextResponse.json(jobPostings);
  } catch (error) {
    console.error('Failed to fetch job postings:', error);
    return NextResponse.json({ error: 'Failed to fetch job postings' }, { status: 500 });
  }
}
