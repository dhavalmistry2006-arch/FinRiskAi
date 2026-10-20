FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OMP_NUM_THREADS=2 MPLCONFIGDIR=/tmp/matplotlib
WORKDIR /app
COPY ml-service/requirements.lock.txt ./requirements.lock.txt
RUN --mount=type=secret,id=build_ca,target=/tmp/build-ca.pem \
    if [ -f /tmp/build-ca.pem ]; then export PIP_CERT=/tmp/build-ca.pem; fi; pip install --no-cache-dir -r requirements.lock.txt
COPY ml-service/ ./
# Train reproducibly at image-build time; serving never retrains automatically.
RUN python train.py && useradd --uid 10001 --create-home inference && chmod -R a+rX /app
USER inference
EXPOSE 8000
HEALTHCHECK --interval=20s --timeout=5s CMD python -c "import json,urllib.request; assert json.load(urllib.request.urlopen('http://127.0.0.1:8000/health'))['modelLoaded']"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
