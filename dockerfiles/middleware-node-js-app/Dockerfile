# Use the official Node.js image
FROM node:18

# Switch to root user to install additional packages
USER root

# Update and install packages
RUN apt-get update && \
    apt-get install -y \
        curl \
        dnsutils \
        netcat-openbsd \
        less \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create and set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the application's port (if needed)
EXPOSE 3000

# Start the backend server
CMD ["node", "app.js"]
