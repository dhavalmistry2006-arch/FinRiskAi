# Infrastructure boundaries

The root Compose file is the local topology; backend and frontend Dockerfiles use their service directory as build context, while ML uses the root context so its generated dataset/provenance path is available at build time. `.dockerignore` files prevent host credentials, caches and generated application outputs from leaking into images.

MongoDB is internal and persistent. nginx is published to host loopback. The inference service has no public port. No production credentials or cloud infrastructure are provisioned by these files. See `docs/DEPLOYMENT.md` before hosting publicly.
