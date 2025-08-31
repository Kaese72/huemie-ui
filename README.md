# Huemie UI

This UI is intended to be used with the Huemie system to visualize and act on devices in your home

## Development

A few things are required to make development easy.

1. NPM/Vite development packages
2. Access to Huemie APIs (Remote or locally)
3. Nginx proxying the UI and service under the same IP

### Run development server

> npm run dev

This opens up a development server, likely on http://localhost:5173/

### Huemie APIs

TODO - Currently the APIs are hosted in Kubernetes, so I am proxying the requests there

### Nginx proxying

I am pcurrently proxying with an nginx config like so

```
worker_processes  1;
events {
    worker_connections  1024;
}
http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;
    server {
        listen       80;
        server_name  localhost;
        location / {
            proxy_pass http://localhost:5173;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
        location /device-store {
            proxy_pass http://app.huemie.space;
        }

    }
}
```

This means that if the API is available at app.huemie.space and the Development server is opened at localhost:5173
the UI behaves pretty much like it will be once built and deployed, except that it has the Vite debugging stuff injected