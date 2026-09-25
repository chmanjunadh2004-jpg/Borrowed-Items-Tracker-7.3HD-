pipeline {
    agent any

    options {
        disableConcurrentBuilds()
    }

    triggers {
        cron('H/15 * * * *')
    }

    environment {
        ALERT_TO = 'ch.manjunadh2004@gmail.com'
    }

    stages {
        stage('Build') {
            when { not { triggeredBy 'TimerTrigger' } }
            steps {
                bat 'node --version'
                bat 'npm.cmd --version'
                bat 'npm.cmd ci'
                bat 'if exist borroweditemstracker-*.tgz del /q borroweditemstracker-*.tgz'
                bat 'npm.cmd pack'
                archiveArtifacts artifacts: '*.tgz', fingerprint: true
            }
        }

        stage('Test') {
            when { not { triggeredBy 'TimerTrigger' } }
            steps {
                bat 'npm.cmd test'
            }
        }

        stage('Code Quality') {
            when { not { triggeredBy 'TimerTrigger' } }
            steps {
                bat 'npm.cmd run lint'
            }
        }

        stage('Security') {
            when { not { triggeredBy 'TimerTrigger' } }
            steps {
                bat 'npm.cmd audit --audit-level=high'
            }
        }

        stage('Deploy') {
            when { not { triggeredBy 'TimerTrigger' } }
            steps {
                powershell '.\\scripts\\deploy.ps1 -Target staging -Port 3001'
            }
        }

        stage('Release') {
            when { not { triggeredBy 'TimerTrigger' } }
            steps {
                powershell '.\\scripts\\deploy.ps1 -Target production -Port 3002'
            }
        }

        stage('Monitoring and Alerting') {
            steps {
                powershell '''
                    $ErrorActionPreference = 'Stop'

                    foreach ($port in 3001, 3002) {
                        $health = Invoke-RestMethod "http://localhost:$port/health" -TimeoutSec 5

                        if ($health.status -ne 'ok') {
                            throw "Health check failed on port $port"
                        }

                        Write-Host "Health check passed on port $port"
                    }
                '''
            }
        }
    }

    post {
        failure {
            emailext(
                to: env.ALERT_TO,
                subject: "Borrowed Items Tracker alert: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: "A pipeline stage or health check failed. See ${env.BUILD_URL}"
            )
        }
    }
}