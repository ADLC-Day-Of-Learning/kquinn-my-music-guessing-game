# Music Game YAML Configuration

## 1. Create the Namespace 


1. Create a `music-game` namespace to isolate the resources for the
application.

``` highlight
apiVersion: v1
kind: Namespace
metadata:
  name: music-game
```

2. Apply the namespace definition:

``` highlight
$ oc apply -f appns.yaml
```

## 2. Elevate Privileges for the default Service Account 

The default policy is restrictive, so you may need to temporarily
elevate the privileges for the default service account until a dedicated
service account is set up for the `music-game` namespace.

``` highlight
$ oc adm policy add-scc-to-user privileged -z default -n music-game
```

## 3. Deploy Services 

1. Change to the `services-files` directory:

``` highlight
$ cd ../services-files
```

### Frontend HTML Service 

1. Create a service to expose the Nginx frontend:

``` highlight
apiVersion: v1
kind: Service
metadata:
  name: frontend-html-service
  namespace: music-game
spec:
  type: LoadBalancer
  selector:
    app: nginx
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

2. Apply the frontend service YAML:

``` highlight
$ oc apply -f feservice.yaml
```

### MongoDB Service 

1. Create a service for MongoDB:

``` highlight
apiVersion: v1
kind: Service
metadata:
  name: mongodb-service
  namespace: music-game
spec:
  selector:
    app: mongodb
  ports:
    - protocol: TCP
      port: 27017
      targetPort: 27017
```

2. Apply the MongoDB service definition:

``` highlight
$ oc apply -f servicedb.yaml
```

### Node.js Service

1. Create a service to expose the Node.js backend:

``` highlight
apiVersion: v1
kind: Service
metadata:
  name: nodejs-service
  namespace: music-game
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: nodejs-app
```

2. Apply the Node.js service YAML:

``` highlight
$ oc apply -f nodejs-service.yaml
```

## 4. Create Routes 

1. Change to the `route-files` directory:

``` highlight
$ cd ../route-files
```
### Node.js Route 

1. Create a route to expose the Node.js backend:

``` highlight
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: nodejs-route
  namespace: music-game
spec:
  to:
    kind: Service
    name: nodejs-service
  port:
    targetPort: 3000
```

2. Apply the Node.js route definition:

``` highlight
$ oc apply -f nodejs-route.yaml
```

### Nginx Route {#_nginx_route}

1. Create a route to expose the frontend service:

``` highlight
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: nginx-route
  namespace: music-game
spec:
  to:
    kind: Service
    name: frontend-html-service
  port:
    targetPort: 8080
```

2. Apply the frontend route definition:

``` highlight
$ oc apply -f feroute.yaml
```

## 5. Create ConfigMaps

Create ConfigMaps to dynamically manage configuration values for the
backend URL and allowed origins.

### Create Backend URL ConfigMap 

``` highlight
$ oc create configmap backend-config -n music-game --from-literal=BACKEND_URL=$(oc get route nodejs-route -n music-game -o jsonpath='{.spec.host}')
```

### Create Allowed Origins ConfigMap

``` highlight
$ oc create configmap frontend-config -n music-game --from-literal=ALLOWED_ORIGINS=$(oc get route nginx-route -n music-game -o jsonpath='{.spec.host}')
```

## 6. Deploy Persistent Volume and Persistent Volume Claim 


1. Change to the `pv-files` directory:

``` highlight
$ cd ../pv-files
```

### MongoDB PVC 


1. Create a PVC for MongoDB:

``` highlight
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
  namespace: music-game
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: manual
```

2. Apply the PVC definition:

``` highlight
$ oc apply -f pvmongo.yaml
```

### MongoDB PV 


1. Create a PV for MongoDB:

``` highlight
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mongodb-pv
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: /mnt/data/mongodb
    type: DirectoryOrCreate
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
```


2. Apply the PV definition:

``` highlight
$ oc apply -f pvcmongo.yaml
```

## 7. Deploy Application Components 

1. Change to the `deployment-files` directory:

``` highlight
$ cd ../deployment-files
```

### MongoDB Deployment 


1. Deploy MongoDB with persistent storage:

``` highlight
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
  namespace: music-game
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      securityContext:
        fsGroup: 1000710000
      containers:
        - name: mongodb
          image: quay.io/rhn_support_kquinn/mymongodb-advanced-v2:latest
          ports:
            - containerPort: 27017
          volumeMounts:
            - name: mongodb-data
              mountPath: /data/db
          securityContext:
            runAsUser: 1000710000
            privileged: true
      volumes:
        - name: mongodb-data
          persistentVolumeClaim:
            claimName: mongodb-pvc
```

2. Apply the MongoDB deployment:

``` highlight
$ oc apply -f deploybemongo.yaml
```

### Node.js Backend Deployment 

1. Deploy the node.js application:

``` highlight
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodejs-app
  namespace: music-game
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nodejs-app
  template:
    metadata:
      labels:
        app: nodejs-app
    spec:
      containers:
        - name: nodejs-app
          image: quay.io/rhn_support_kquinn/middleware-node-js-app-conns-pooling:latest
          ports:
            - containerPort: 3000
          env:
            - name: MONGO_URL
              value: 'mongodb://mongodb-service:27017'
            - name: DB_NAME
              value: musicgame
            - name: ALLOWED_ORIGINS
              valueFrom:
                configMapKeyRef:
                  name: frontend-config
                  key: ALLOWED_ORIGINS
            - name: BACKEND_URL
              valueFrom:
                configMapKeyRef:
                  name: backend-config
                  key: BACKEND_URL
```

2. Apply the Node.js deployment:

``` highlight
$ oc apply -f nodejs-deployment.yaml
```

### Nginx Frontend Deployment 

1. Deploy the Nginx application:

``` highlight
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  namespace: music-game
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: quay.io/rhn_support_kquinn/guess-music-fe-app-advanced:latest
          ports:
            - containerPort: 8080
          volumeMounts:
            - name: cache-volume
              mountPath: /var/cache/nginx
          env:
            - name: BACKEND_URL
              valueFrom:
                configMapKeyRef:
                  name: backend-config
                  key: BACKEND_URL
          securityContext:
            runAsUser: 0
            allowPrivilegeEscalation: true
          command: ["/bin/sh"]
          args: ["-c",
          "envsubst '${BACKEND_URL}' < /usr/share/nginx/html/index.html.template > /usr/share/nginx/html/index.html && \
           envsubst '${BACKEND_URL}' < /usr/share/nginx/html/script.js.template > /usr/share/nginx/html/script.js && \
           envsubst '${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf && \
           mv /tmp/nginx.conf /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
        volumes:
          - name: cache-volume
            emptyDir: {}
```

2. Apply the Nginx deployment:

``` highlight
$ oc apply -f html_deploy_fe.yaml
```
