pipeline {
    agent any

    stages {
        stage('Build') {
            steps {
                bat 'node --version'
                bat 'npm.cmd --version'
                bat 'npm.cmd ci'
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

    }
}