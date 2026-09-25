pipeline {
    agent any

    stages {
        stage('Build') {
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
            steps {
                bat 'npm.cmd test'
            }
        }
        stage('Code Quality') {
            steps {
                bat 'npm.cmd run lint'
            }
        }
        stage('Security') {
            steps {
                bat 'npm.cmd audit --audit-level=high'
            }
        }
        

    }
}