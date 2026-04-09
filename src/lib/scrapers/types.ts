import { JobSource } from "@prisma/client";

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  source: JobSource;
  salary?: string;
  workType?: string;
  postedAt?: Date;
}
