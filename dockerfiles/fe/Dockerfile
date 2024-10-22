# Use the official NGINX image
FROM nginx:latest

# Remove the default NGINX configuration if it exists
RUN rm /etc/nginx/conf.d/default.conf || true

# Copy custom NGINX configuration template
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy the HTML template, JavaScript, and music clips into the container
COPY index.html.template /usr/share/nginx/html/index.html.template
COPY script.js.template /usr/share/nginx/html/script.js.template
COPY *.mp3 /usr/share/nginx/html/audio/

# Copy the images folder into the container
COPY images /usr/share/nginx/html/images/

# Install gettext-base to use envsubst for variable substitution
RUN apt-get update && apt-get install -y gettext-base

# Ensure nginx user has write permissions on the directory
RUN chown -R nginx:nginx /usr/share/nginx/html && chmod -R 775 /usr/share/nginx/html

# Switch to unprivileged nginx user
USER nginx

# Expose port 8080 for HTTP traffic
EXPOSE 8080

# Use envsubst to replace placeholders in both nginx.conf, index.html, and script.js with actual BACKEND_URL
CMD ["sh", "-c", "envsubst '${BACKEND_URL}' < /usr/share/nginx/html/index.html.template > /usr/share/nginx/html/index.html && \
    envsubst '${BACKEND_URL}' < /usr/share/nginx/html/script.js.template > /usr/share/nginx/html/script.js && \
    envsubst '${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && \
    nginx -g 'daemon off;'"]
