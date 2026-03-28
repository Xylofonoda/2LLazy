export const typeDefs = `#graphql
  enum JobSource {
    LINKEDIN
    GLASSDOOR
    STARTUPJOBS
    JOBSTACK
  }

  enum ApplicationStatus {
    PENDING
    APPLIED
    REJECTED
    INTERVIEW
    FAILED
  }

  enum SiteName {
    LINKEDIN
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

  type SiteCredentialStatus {
    site: SiteName!
    configured: Boolean!
    username: String
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

  type OllamaHealth {
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
    getSiteCredentials: [SiteCredentialStatus!]!
    getUserProfile: UserProfile
    ollamaHealth: OllamaHealth!
  }

  type Mutation {
    toggleFavourite(jobId: ID!): JobPosting!
    applyToJob(jobId: ID!, coverLetterId: ID): Application!
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
    saveSiteCredentials(site: SiteName!, username: String!, password: String!): SiteCredentialStatus!
    saveUserProfile(
      name: String!
      email: String!
      phone: String
      linkedInUrl: String
      githubUrl: String
    ): UserProfile!
  }
`;
