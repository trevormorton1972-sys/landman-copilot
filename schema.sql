-- Multi-Tenant Landman Indexing SaaS Database Schema for PostgreSQL
-- Supports multiple organizations, users, portals, and credentials

-- ============================================================================
-- CREATE ENUM TYPES
-- ============================================================================
CREATE TYPE auth_type_enum AS ENUM ('username_password', 'sso', 'api_key');
CREATE TYPE search_status_enum AS ENUM ('queued', 'running', 'completed', 'paused', 'failed');
CREATE TYPE search_result_status_enum AS ENUM ('new', 'marked_for_review', 'excluded', 'reviewed');
CREATE TYPE party_role_enum AS ENUM ('grantor', 'grantee', 'both');
CREATE TYPE ai_assessment_enum AS ENUM ('meets_criteria', 'probable_match', 'exclude', 'pending');
CREATE TYPE user_decision_enum AS ENUM ('approved', 'rejected', 'needs_review', 'pending');

-- ============================================================================
-- ORGANIZATIONS (Brokerage Firms)
-- ============================================================================
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  is_individual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- USERS (Individual Landmen)
-- ============================================================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  UNIQUE(organization_id, email)
);

-- ============================================================================
-- PORTALS (Available Search Portals)
-- ============================================================================
CREATE TABLE portals (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  url VARCHAR(500) NOT NULL,
  description TEXT,
  auth_type auth_type_enum DEFAULT 'username_password',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- PORTAL_CREDENTIALS (User Credentials for Each Portal)
-- ============================================================================
CREATE TABLE portal_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portal_id INTEGER NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,
  encrypted_password VARCHAR(500) NOT NULL,
  credential_label VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, portal_id, username)
);

-- ============================================================================
-- COUNTIES (Geographic/Jurisdiction Data)
-- ============================================================================
CREATE TABLE counties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, state)
);

-- ============================================================================
-- PORTAL_COUNTY_COVERAGE (Which portals cover which counties)
-- ============================================================================
CREATE TABLE portal_county_coverage (
  id SERIAL PRIMARY KEY,
  portal_id INTEGER NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  county_id INTEGER NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  record_start_date DATE,
  record_end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(portal_id, county_id)
);

-- ============================================================================
-- SEARCH_TASKS (Queued Searches)
-- ============================================================================
CREATE TABLE search_tasks (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portal_id INTEGER NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  county_id INTEGER NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  status search_status_enum DEFAULT 'queued',
  priority INTEGER DEFAULT 5,
  
  -- Search Criteria
  party_name VARCHAR(255),
  party_role party_role_enum DEFAULT 'both',
  date_from DATE,
  date_to DATE,
  legal_description TEXT,
  document_reference VARCHAR(255),
  
  -- Execution Details
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- ============================================================================
-- SEARCH_RESULTS (Index Results from Portal Searches)
-- ============================================================================
CREATE TABLE search_results (
  id SERIAL PRIMARY KEY,
  search_task_id INTEGER NOT NULL REFERENCES search_tasks(id) ON DELETE CASCADE,
  document_number VARCHAR(255) NOT NULL,
  recording_date DATE,
  grantor VARCHAR(255),
  grantee VARCHAR(255),
  document_type VARCHAR(100),
  legal_description TEXT,
  page_count INTEGER,
  portal_url VARCHAR(1000),
  
  -- User Review Status
  status search_result_status_enum DEFAULT 'new',
  review_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(search_task_id, document_number)
);

-- ============================================================================
-- DOCUMENTS (Master Document Record - Deduplication)
-- ============================================================================
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  portal_id INTEGER NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  county_id INTEGER NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  
  document_number VARCHAR(255) NOT NULL,
  document_type VARCHAR(100),
  recording_date DATE,
  grantor VARCHAR(255),
  grantee VARCHAR(255),
  legal_description TEXT,
  page_count INTEGER,
  
  -- File Storage Info
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  file_size INTEGER,
  file_hash VARCHAR(64),
  
  -- Portal Info
  portal_url VARCHAR(1000),
  
  -- Metadata
  downloaded_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(organization_id, portal_id, county_id, document_number)
);

-- ============================================================================
-- DOCUMENT_INSTANCES (Tracking each time a document is found in a search)
-- ============================================================================
CREATE TABLE document_instances (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  search_result_id INTEGER NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
  
  -- When this specific instance was found
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DOCUMENT_REVIEWS (AI Review of PDF Documents)
-- ============================================================================
CREATE TABLE document_reviews (
  id SERIAL PRIMARY KEY,
  search_result_id INTEGER NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- AI Analysis
  ai_assessment ai_assessment_enum DEFAULT 'pending',
  ai_confidence NUMERIC(3, 2),
  ai_evidence TEXT,
  ai_relevant_pages TEXT,
  ai_quotes TEXT,
  
  -- User Verification
  user_confirmed BOOLEAN DEFAULT FALSE,
  user_decision user_decision_enum DEFAULT 'pending',
  user_notes TEXT,
  
  marked_for_download BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DOCUMENT_DOWNLOADS (Track all downloads with audit trail)
-- ============================================================================
CREATE TABLE document_downloads (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  search_task_id INTEGER NOT NULL REFERENCES search_tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_review_id INTEGER REFERENCES document_reviews(id) ON DELETE SET NULL,
  
  -- Download Details
  downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_size_at_download INTEGER,
  download_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES (Performance Optimization)
-- ============================================================================
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_portal_credentials_user ON portal_credentials(user_id);
CREATE INDEX idx_portal_credentials_portal ON portal_credentials(portal_id);
CREATE INDEX idx_search_tasks_user ON search_tasks(user_id);
CREATE INDEX idx_search_tasks_organization ON search_tasks(organization_id);
CREATE INDEX idx_search_tasks_status ON search_tasks(status);
CREATE INDEX idx_search_tasks_priority ON search_tasks(priority);
CREATE INDEX idx_search_results_search_task ON search_results(search_task_id);
CREATE INDEX idx_search_results_status ON search_results(status);
CREATE INDEX idx_document_reviews_search_result ON document_reviews(search_result_id);
CREATE INDEX idx_document_reviews_user ON document_reviews(user_id);
CREATE INDEX idx_documents_organization ON documents(organization_id);
CREATE INDEX idx_documents_portal ON documents(portal_id);
CREATE INDEX idx_documents_county ON documents(county_id);
CREATE INDEX idx_documents_number ON documents(document_number);
CREATE INDEX idx_document_instances_document ON document_instances(document_id);
CREATE INDEX idx_document_instances_search_result ON document_instances(search_result_id);
CREATE INDEX idx_document_downloads_document ON document_downloads(document_id);
CREATE INDEX idx_document_downloads_user ON document_downloads(user_id);
CREATE INDEX idx_document_downloads_search_task ON document_downloads(search_task_id);
