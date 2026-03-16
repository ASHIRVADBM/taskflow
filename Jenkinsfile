// ─────────────────────────────────────────────────────────────────────────────
// TaskFlow — Jenkins Declarative Pipeline
// Stages: Checkout → Lint → Test → Security → Build → Push → Deploy
// ─────────────────────────────────────────────────────────────────────────────

pipeline {

    agent any

    // ── Tool versions ────────────────────────────────────────────────────────
    tools {
        nodejs 'NodeJS-20'    // Configure in: Manage Jenkins → Tools → NodeJS
    }

    // ── Pipeline-level environment variables ─────────────────────────────────
    environment {
        APP_NAME        = 'taskflow'
        REGISTRY        = 'ghcr.io'
        GITHUB_USERNAME = 'ASHIRVADBM'
        BACKEND_IMAGE   = "${REGISTRY}/${GITHUB_USERNAME}/taskflow-backend"
        FRONTEND_IMAGE  = "${REGISTRY}/${GITHUB_USERNAME}/taskflow-frontend"
        IMAGE_TAG       = "jenkins-${BUILD_NUMBER}-${GIT_COMMIT[0..6]}"

        // Credentials stored in Jenkins Credentials Store
        GITHUB_TOKEN    = credentials('github-token')
        DB_PASSWORD     = credentials('db-password')
        SLACK_WEBHOOK   = credentials('slack-webhook-url')
    }

    // ── Build options ─────────────────────────────────────────────────────────
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 45, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
        ansiColor('xterm')
    }

    // ── Trigger: poll SCM every 5 min OR webhook ──────────────────────────────
    triggers {
        pollSCM('H/5 * * * *')
        githubPush()
    }

    // ═════════════════════════════════════════════════════════════════════════
    stages {

        // ── STAGE 1: Checkout ─────────────────────────────────────────────────
        stage('📥 Checkout') {
            steps {
                echo "Branch: ${env.BRANCH_NAME} | Build: #${BUILD_NUMBER}"
                checkout scm
                sh 'git log --oneline -5'
            }
        }

        // ── STAGE 2: Install Dependencies ─────────────────────────────────────
        stage('📦 Install Dependencies') {
            parallel {
                stage('Backend deps') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Frontend deps') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                        }
                    }
                }
            }
        }

        // ── STAGE 3: Lint ─────────────────────────────────────────────────────
        stage('🔍 Lint') {
            parallel {
                stage('Lint Backend') {
                    steps {
                        dir('backend') {
                            sh 'npx eslint src/ --ext .js --format checkstyle --output-file eslint-backend.xml || true'
                            sh 'npx eslint src/ --ext .js || true'
                        }
                    }
                    post {
                        always {
                            recordIssues(
                                tools: [esLint(pattern: 'backend/eslint-backend.xml')],
                                qualityGates: [[threshold: 10, type: 'TOTAL', unstable: true]]
                            )
                        }
                    }
                }
                stage('Lint Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npx eslint src/ --ext .jsx,.js || true'
                        }
                    }
                }
            }
        }

        // ── STAGE 4: Test ─────────────────────────────────────────────────────
        stage('🧪 Test') {
            parallel {
                stage('Backend Tests') {
                    environment {
                        DB_HOST     = 'localhost'
                        DB_PORT     = '5432'
                        DB_NAME     = 'taskflow_test'
                        DB_USER     = 'postgres'
                        DB_PASSWORD = 'postgres'
                        NODE_ENV    = 'test'
                    }
                    steps {
                        // Start a temporary PostgreSQL container for tests
                        sh '''
                            docker run -d \
                                --name postgres-test-${BUILD_NUMBER} \
                                -e POSTGRES_DB=taskflow_test \
                                -e POSTGRES_USER=postgres \
                                -e POSTGRES_PASSWORD=postgres \
                                -p 5432:5432 \
                                --health-cmd="pg_isready -U postgres" \
                                --health-interval=5s \
                                postgres:16-alpine
                            
                            # Wait for PostgreSQL to be ready
                            for i in $(seq 1 20); do
                                if docker exec postgres-test-${BUILD_NUMBER} pg_isready -U postgres; then
                                    echo "PostgreSQL ready!"
                                    break
                                fi
                                echo "Waiting... ($i/20)"
                                sleep 3
                            done
                        '''
                        dir('backend') {
                            sh 'npm test -- --coverage --coverageReporters=lcov --coverageReporters=cobertura'
                        }
                    }
                    post {
                        always {
                            // Cleanup test DB container
                            sh 'docker rm -f postgres-test-${BUILD_NUMBER} || true'

                            // Publish test results
                            junit(
                                testResults: 'backend/coverage/junit.xml',
                                allowEmptyResults: true
                            )
                            // Publish code coverage
                            cobertura(
                                coberturaReportFile: 'backend/coverage/cobertura-coverage.xml',
                                onlyStable: false,
                                failNoReports: false,
                                conditionalCoverageTargets: '70, 0, 0',
                                lineCoverageTargets: '80, 0, 0'
                            )
                        }
                    }
                }

                stage('Frontend Build Test') {
                    steps {
                        dir('frontend') {
                            sh 'npm run build'
                        }
                    }
                    post {
                        success {
                            archiveArtifacts(
                                artifacts: 'frontend/dist/**',
                                fingerprint: true,
                                allowEmptyArchive: false
                            )
                        }
                    }
                }
            }
        }

        // ── STAGE 5: Security Scan ─────────────────────────────────────────────
        stage('🔒 Security Scan') {
            parallel {
                stage('npm Audit Backend') {
                    steps {
                        dir('backend') {
                            sh 'npm audit --audit-level=high --json > npm-audit-backend.json || true'
                            sh 'npm audit --audit-level=high || true'
                        }
                    }
                }
                stage('npm Audit Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npm audit --audit-level=high || true'
                        }
                    }
                }
                stage('Trivy Filesystem Scan') {
                    steps {
                        sh '''
                            # Install Trivy if not present
                            if ! command -v trivy &> /dev/null; then
                                curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
                            fi
                            trivy fs . \
                                --severity HIGH,CRITICAL \
                                --format table \
                                --exit-code 0 \
                                --ignore-unfixed \
                                --output trivy-fs-report.txt
                            cat trivy-fs-report.txt
                        '''
                        archiveArtifacts artifacts: 'trivy-fs-report.txt', allowEmptyArchive: true
                    }
                }
            }
        }

        // ── STAGE 6: Docker Build & Push ───────────────────────────────────────
        stage('🐳 Docker Build & Push') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                script {
                    // Login to GHCR
                    sh "echo ${GITHUB_TOKEN} | docker login ${REGISTRY} -u ${GITHUB_USERNAME} --password-stdin"

                    // Build and push backend
                    sh """
                        docker build \
                            -t ${BACKEND_IMAGE}:${IMAGE_TAG} \
                            -t ${BACKEND_IMAGE}:latest \
                            --label "build.number=${BUILD_NUMBER}" \
                            --label "git.commit=${GIT_COMMIT}" \
                            --label "git.branch=${BRANCH_NAME}" \
                            ./backend
                        docker push ${BACKEND_IMAGE}:${IMAGE_TAG}
                        docker push ${BACKEND_IMAGE}:latest
                    """

                    // Build and push frontend
                    sh """
                        docker build \
                            -t ${FRONTEND_IMAGE}:${IMAGE_TAG} \
                            -t ${FRONTEND_IMAGE}:latest \
                            --build-arg VITE_API_URL=http://localhost:5000 \
                            --label "build.number=${BUILD_NUMBER}" \
                            --label "git.commit=${GIT_COMMIT}" \
                            ./frontend
                        docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}
                        docker push ${FRONTEND_IMAGE}:latest
                    """

                    // Scan built images
                    sh """
                        trivy image \
                            --severity HIGH,CRITICAL \
                            --format table \
                            --exit-code 0 \
                            --ignore-unfixed \
                            ${BACKEND_IMAGE}:${IMAGE_TAG} || true
                    """

                    echo "✅ Images pushed: ${IMAGE_TAG}"
                }
            }
            post {
                always {
                    sh 'docker logout ${REGISTRY} || true'
                }
            }
        }

        // ── STAGE 7: Deploy to Staging ─────────────────────────────────────────
        stage('🌿 Deploy → Staging') {
            when {
                branch 'develop'
            }
            environment {
                ANSIBLE_HOST_KEY_CHECKING = 'False'
                STAGING_SSH_KEY           = credentials('staging-ssh-key')
            }
            steps {
                withCredentials([
                    file(credentialsId: 'ansible-vault-password', variable: 'VAULT_PASS_FILE'),
                    string(credentialsId: 'staging-inventory', variable: 'STAGING_INV')
                ]) {
                    sh '''
                        # Write staging inventory
                        echo "${STAGING_INV}" > /tmp/staging-inventory.ini

                        # Install Ansible if needed
                        pip install ansible --quiet

                        # Run Ansible rolling deploy
                        cd ansible
                        ansible-playbook deploy.yml \
                            -i /tmp/staging-inventory.ini \
                            --vault-password-file ${VAULT_PASS_FILE} \
                            --private-key ${STAGING_SSH_KEY} \
                            -e "image_tag=${IMAGE_TAG}" \
                            -e "env=staging" \
                            -v

                        rm -f /tmp/staging-inventory.ini
                    '''
                }
            }
        }

        // ── STAGE 8: Deploy to Production ─────────────────────────────────────
        stage('🚀 Deploy → Production') {
            when {
                branch 'main'
            }
            // Requires manual approval
            input {
                message "Deploy ${IMAGE_TAG} to PRODUCTION?"
                ok "Yes, Deploy!"
                submitter "admin,lead-dev"
                parameters {
                    string(name: 'DEPLOY_NOTE', defaultValue: '', description: 'Optional deploy note')
                }
            }
            environment {
                ANSIBLE_HOST_KEY_CHECKING = 'False'
                PROD_SSH_KEY              = credentials('prod-ssh-key')
            }
            steps {
                withCredentials([
                    file(credentialsId: 'ansible-vault-password', variable: 'VAULT_PASS_FILE'),
                    string(credentialsId: 'prod-inventory', variable: 'PROD_INV')
                ]) {
                    sh '''
                        echo "${PROD_INV}" > /tmp/prod-inventory.ini

                        cd ansible
                        ansible-playbook deploy.yml \
                            -i /tmp/prod-inventory.ini \
                            --vault-password-file ${VAULT_PASS_FILE} \
                            --private-key ${PROD_SSH_KEY} \
                            -e "image_tag=${IMAGE_TAG}" \
                            -e "env=production" \
                            -v

                        rm -f /tmp/prod-inventory.ini
                    '''
                }
            }
        }

    } // end stages

    // ═════════════════════════════════════════════════════════════════════════
    // Post-build Actions
    // ═════════════════════════════════════════════════════════════════════════
    post {

        success {
            echo "✅ Pipeline PASSED — Build #${BUILD_NUMBER} (${IMAGE_TAG})"
            slackSend(
                color: 'good',
                message: """✅ *TaskFlow Build SUCCESS*
• Job: `${JOB_NAME}` #${BUILD_NUMBER}
• Branch: `${BRANCH_NAME}`
• Tag: `${IMAGE_TAG}`
• Duration: ${currentBuild.durationString}
• <${BUILD_URL}|View Build>"""
            )
        }

        failure {
            echo "❌ Pipeline FAILED — Build #${BUILD_NUMBER}"
            slackSend(
                color: 'danger',
                message: """❌ *TaskFlow Build FAILED*
• Job: `${JOB_NAME}` #${BUILD_NUMBER}
• Branch: `${BRANCH_NAME}`
• Stage: ${currentBuild.result}
• <${BUILD_URL}console|View Console>"""
            )
            // Email notification
            emailext(
                subject: "FAILED: TaskFlow Build #${BUILD_NUMBER}",
                body: """Build #${BUILD_NUMBER} failed on branch ${BRANCH_NAME}.
Check the console output: ${BUILD_URL}console""",
                to: '$DEFAULT_RECIPIENTS'
            )
        }

        unstable {
            slackSend(
                color: 'warning',
                message: "⚠️ *TaskFlow Build UNSTABLE* — #${BUILD_NUMBER} | `${BRANCH_NAME}` | <${BUILD_URL}|Details>"
            )
        }

        always {
            // Clean workspace to save disk space
            cleanWs(
                cleanWhenNotBuilt: false,
                deleteDirs: true,
                disableDeferredWipeout: true,
                notFailBuild: true,
                patterns: [
                    [pattern: '.gitignore', type: 'INCLUDE'],
                    [pattern: 'node_modules/**', type: 'INCLUDE']
                ]
            )
        }
    }

} // end pipeline
