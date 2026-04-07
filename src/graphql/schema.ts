export const typeDefs = `#graphql
  enum JobSource {
    STARTUPJOBS
    JOBSTACK
    COCUMA
  }

  enum ApplicationStatus {
    PENDING
    APPLIED
    REJECTED
    INTERVIEW
    FAILED
  }

  type JobPosting {
    id: ID!
    title: String!
    company: String!
    location: String
    description: String!
    sourceUrl: String!
    source: JobSource!
    salary: String
    postedAt: String
    scrapedAt: String!
    similarity: Float
    favourited: Boolean!
  }

  type Application {
    id: ID!
    job: JobPosting!
    status: ApplicationStatus!
    appliedAt: String
    errorMessage: String
    coverLetter: CoverLetter
    interview: Interview
    createdAt: String!
  }

  type CoverLetter {
    id: ID!
    jobId: ID!
    content: String!
    generatedByAI: Boolean!
    createdAt: String!
  }

  type Interview {
    id: ID!
    applicationId: ID!
    scheduledAt: String!
    durationMinutes: Int!
    timezone: String!
    notes: String
  }

  type UserProfile {
    id: ID!
    name: String!
    email: String!
    phone: String
    cvPath: String
    linkedInUrl: String
    githubUrl: String
  }

  type AIHealth {
    ok: Boolean!
    missing: [String!]!
  }

  type Query {
    searchJobs(query: String!, skillLevel: String, limit: Int): [JobPosting!]!
    getFavourites: [JobPosting!]!
    getApplications(status: ApplicationStatus): [Application!]!
    getApplication(id: ID!): Application
    getInterviews(month: Int!, year: Int!): [Interview!]!
    getCoverLetter(id: ID!): CoverLetter
    getUserProfile: UserProfile
    aiHealth: AIHealth!
  }

  type Mutation {
    toggleFavourite(jobId: ID!): JobPosting!
    updateApplicationStatus(id: ID!, status: ApplicationStatus!): Application!
    scheduleInterview(
      applicationId: ID!
      scheduledAt: String!
      durationMinutes: Int
      timezone: String
      notes: String
    ): Interview!
    updateInterview(
      id: ID!
      scheduledAt: String
      durationMinutes: Int
      notes: String
    ): Interview!
    generateCoverLetter(jobId: ID!, useSavedCV: Boolean): CoverLetter!
    deleteCoverLetter(id: ID!): Boolean!
    saveUserProfile(
      name: String!
      email: String!
      phone: String
      linkedInUrl: String
      githubUrl: String
    ): UserProfile!
  }
`;
