-- TaskFlow Database Initialization
-- This script runs automatically on first PostgreSQL container start

CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255)    NOT NULL,
    description TEXT,
    status      VARCHAR(50)     NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in-progress', 'completed')),
    priority    VARCHAR(20)     NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created  ON tasks(created_at DESC);

-- Seed data for demo
INSERT INTO tasks (title, description, priority, status) VALUES
    ('Setup CI/CD Pipeline',  'Configure GitHub Actions for automated deployments', 'high',   'completed'),
    ('Write Dockerfiles',     'Multi-stage Docker builds for all services',          'high',   'completed'),
    ('Kubernetes Manifests',  'Create deployment and service YAML files',            'medium', 'in-progress'),
    ('Ansible Playbooks',     'Automate infrastructure provisioning',                'medium', 'pending'),
    ('Write Unit Tests',      'Achieve 80%+ code coverage with Jest',               'low',    'pending');
