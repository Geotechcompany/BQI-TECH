export type CvVaultContactSource = "application" | "filename" | "cv_text" | null

export interface CvVaultEntry {
  id: string
  name: string
  email: string
  cvUrl: string
  dropboxPath: string
  fileName: string
  source: "application" | "dropbox" | string
  applicationId?: string | null
  applicationStatus?: string | null
  appliedDate?: string | null
  modifiedAt?: string | null
  size?: number | null
  aiRankScore?: number | null
  aiRankRecommendation?: string | null
  nameSource?: CvVaultContactSource
  emailSource?: CvVaultContactSource
}

export type CvVaultSort =
  | "complete_first"
  | "dropbox_newest"
  | "dropbox_oldest"
  | "applied_newest"
  | "applied_oldest"
  | "name_asc"
  | "name_desc"

export type CvVaultContactFilter = "all" | "complete" | "missing"

export type CvVaultSourceFilter = "all" | "application" | "dropbox"

export interface CvVaultListParams {
  search?: string
  sort?: CvVaultSort
  has_email?: boolean | null
  has_name?: boolean | null
  linked_application?: boolean | null
  source?: CvVaultSourceFilter
  contact_filter?: CvVaultContactFilter
  application_status?: string
  date_from?: string
  date_to?: string
  skip?: number
  limit?: number
}

export interface CvVaultResponse {
  items: CvVaultEntry[]
  total: number
  filteredTotal?: number
  cacheTotal?: number
  skip?: number
  limit?: number
  page?: number
  totalPages?: number
  stats: {
    withEmail: number
    withApplication: number
    dropboxFolders: string[]
    matchingFilters?: number
  }
  matchedStats?: {
    withEmail: number
    withApplication: number
  }
  lastSyncedAt?: string | null
  cached?: boolean
  sort?: CvVaultSort
  filters?: Record<string, unknown>
  sync?: {
    upserted: number
    removed: number
    extractedNames?: number
    extractedEmails?: number
  }
}

export interface CvVaultFilterOptions {
  sorts: Array<{ value: CvVaultSort; label: string }>
  applicationStatuses: string[]
}
