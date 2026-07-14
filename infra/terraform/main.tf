terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
  backend "kubernetes" {
    secret_suffix = "devops-state"
    config_path   = "k3s-output/kubeconfig.yaml"
  }
}

provider "kubernetes" {
  config_path = "k3s-output/kubeconfig.yaml"
}

resource "kubernetes_namespace" "app_namespace" {
  metadata {
    name = "devops-app"
  }
}

# ==========================================
# SECRETS
# ==========================================
resource "kubernetes_secret" "app_secrets" {
  metadata {
    name      = "app-secrets"
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
  }
  data = {
    "DATABASE_URL" = "postgres://postgres:postgres@postgres-service:5432/devops_db"
    "JWT_SECRET"   = "misupersecretosecretojwt2023"
  }
}

# ==========================================
# POSTGRES
# ==========================================
resource "kubernetes_deployment" "postgres" {
  metadata {
    name      = "postgres-deployment"
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
  }
  spec {
    replicas = 1
    selector {
      match_labels = {
        app = "postgres"
      }
    }
    template {
      metadata {
        labels = {
          app = "postgres"
        }
      }
      spec {
        container {
          name  = "postgres"
          image = "localhost:5000/db:latest"
          port {
            container_port = 5432
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "postgres_service" {
  metadata {
    name      = "postgres-service"
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
  }
  spec {
    selector = {
      app = "postgres"
    }
    port {
      port        = 5432
      target_port = 5432
    }
  }
}

# ==========================================
# BACKEND
# ==========================================
resource "kubernetes_deployment" "backend" {
  metadata {
    name      = "backend-deployment"
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
  }
  spec {
    replicas = 1
    selector {
      match_labels = {
        app = "backend"
      }
    }
    template {
      metadata {
        labels = {
          app = "backend"
        }
      }
      spec {
        container {
          name  = "backend"
          image = "localhost:5000/backend:latest"
          image_pull_policy = "Always"
          port {
            container_port = 3001
          }
          env_from {
            secret_ref {
              name = kubernetes_secret.app_secrets.metadata[0].name
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "backend_service" {
  metadata {
    name      = "backend-service"
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
  }
  spec {
    selector = {
      app = "backend"
    }
    port {
      port        = 3001
      target_port = 3001
      node_port   = 30001
    }
    type = "NodePort"
  }
}

# ==========================================
# FRONTEND
# ==========================================
resource "kubernetes_deployment" "frontend" {
  metadata {
    name      = "frontend-deployment"
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
  }
  spec {
    replicas = 1
    selector {
      match_labels = {
        app = "frontend"
      }
    }
    template {
      metadata {
        labels = {
          app = "frontend"
        }
      }
      spec {
        container {
          name  = "frontend"
          image = "localhost:5000/frontend:latest"
          image_pull_policy = "Always"
          port {
            container_port = 80
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "frontend_service" {
  metadata {
    name      = "frontend-service"
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
  }
  spec {
    selector = {
      app = "frontend"
    }
    port {
      port        = 80
      target_port = 80
      node_port   = 30080
    }
    type = "NodePort"
  }
}
