terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.0"
    }
  }
}

provider "docker" {
  # Terraform autodetectará el socket de Docker.
}

resource "docker_image" "k3s" {
  name         = "rancher/k3s:v1.27.4-k3s1"
  keep_locally = true
}

resource "docker_container" "k3s_server" {
  name  = "k3s-server"
  image = docker_image.k3s.image_id
  command = ["server", "--disable=traefik", "--https-listen-port=16443"]
  privileged = true
  
  ports {
    internal = 16443
    external = 16443
  }
  
  # Puerto NodePort para Frontend
  ports {
    internal = 30080
    external = 30080
  }

  # Puerto NodePort para Backend
  ports {
    internal = 30081
    external = 30081
  }

  env = [
    "K3S_KUBECONFIG_OUTPUT=/output/kubeconfig.yaml",
    "K3S_KUBECONFIG_MODE=666"
  ]

  volumes {
    host_path      = "${path.cwd}/k3s-output"
    container_path = "/output"
  }
}
