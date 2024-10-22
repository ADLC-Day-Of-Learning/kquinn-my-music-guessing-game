# Use the official MongoDB 6.x image as the base
FROM mongo:6.0

# Copy init.js script into the Docker image
COPY init.js /docker-entrypoint-initdb.d/

# Expose MongoDB port
EXPOSE 27017

# MongoDB will start automatically when the container runs
