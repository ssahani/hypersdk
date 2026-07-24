FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY run.py .

# PacketWolf itself only serves a FastAPI ingest/query API and talks to
# ClickHouse/OpenSearch over the network — it does not touch eBPF, raw
# sockets, or the host kernel (that happens in the separate host-installed
# Tetragon sensor, outside this container). No elevated privileges needed.
RUN useradd --no-create-home --uid 10001 --shell /usr/sbin/nologin packetwolf \
    && chown -R packetwolf:packetwolf /app
USER packetwolf

EXPOSE 9091
CMD ["python", "run.py"]
