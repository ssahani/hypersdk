//! Decode Prometheus Remote Write 1.0 (`prometheus.WriteRequest`, Snappy block compression).

use prom_remote_api::types::{Label, Sample, TimeSeries, WriteRequest};
use prost::Message;

use crate::prometheus_text::{host_percents_from_samples, parse_prometheus_text, PrometheusSample};

#[derive(Debug, Clone, PartialEq)]
pub struct RemoteWriteDecodeResult {
    pub timeseries_count: usize,
    pub sample_count: usize,
    pub samples: Vec<PrometheusSample>,
}

/// Decompress Snappy (block format) and decode `WriteRequest`.
pub fn decode_remote_write_body(body: &[u8]) -> Result<RemoteWriteDecodeResult, String> {
    let proto = decompress_snappy(body)?;
    let req = WriteRequest::decode(proto.as_slice()).map_err(|e| format!("protobuf decode: {e}"))?;
    Ok(samples_from_write_request(&req))
}

fn decompress_snappy(body: &[u8]) -> Result<Vec<u8>, String> {
    let len = snap::raw::decompress_len(body).map_err(|e| format!("snappy length: {e}"))?;
    let mut out = vec![0u8; len];
    let mut dec = snap::raw::Decoder::new();
    let n = dec
        .decompress(body, &mut out)
        .map_err(|e| format!("snappy decompress: {e}"))?;
    out.truncate(n);
    Ok(out)
}

fn label_value<'a>(labels: &'a [Label], name: &str) -> Option<&'a str> {
    labels
        .iter()
        .find(|l| l.name == name)
        .map(|l| l.value.as_str())
}

/// Flatten time series; keep the latest sample per metric name (last wins).
pub fn samples_from_write_request(req: &WriteRequest) -> RemoteWriteDecodeResult {
    let mut by_name: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    let mut sample_count = 0usize;
    for ts in &req.timeseries {
        let Some(metric) = label_value(&ts.labels, "__name__") else {
            continue;
        };
        if let Some(sample) = ts.samples.last() {
            sample_count += ts.samples.len();
            by_name.insert(metric.to_string(), sample.value);
        }
    }
    let samples: Vec<PrometheusSample> = by_name
        .into_iter()
        .map(|(name, value)| PrometheusSample { name, value })
        .collect();
    RemoteWriteDecodeResult {
        timeseries_count: req.timeseries.len(),
        sample_count,
        samples,
    }
}

/// Encode a minimal remote-write payload (tests and tooling).
pub fn encode_remote_write_body(req: &WriteRequest) -> Result<Vec<u8>, String> {
    let proto = req.encode_to_vec();
    let max = snap::raw::max_compress_len(proto.len());
    let mut out = vec![0u8; max];
    let mut enc = snap::raw::Encoder::new();
    let n = enc
        .compress(&proto, &mut out)
        .map_err(|e| format!("snappy compress: {e}"))?;
    out.truncate(n);
    Ok(out)
}

/// Build a single-gauge write request.
pub fn write_request_with_gauge(name: &str, value: f64, timestamp_ms: i64) -> WriteRequest {
    WriteRequest {
        timeseries: vec![TimeSeries {
            labels: vec![
                Label {
                    name: "__name__".into(),
                    value: name.into(),
                },
                Label {
                    name: "job".into(),
                    value: "machina".into(),
                },
            ],
            samples: vec![Sample {
                value,
                timestamp: timestamp_ms,
            }],
            exemplars: Vec::new(),
        }],
        metadata: Vec::new(),
    }
}

/// Map decoded remote-write samples to host utilization when Machina metric names are present.
pub fn host_percents_from_remote_write(
    result: &RemoteWriteDecodeResult,
) -> Option<(f64, f64, f64)> {
    host_percents_from_samples(&result.samples)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_remote_write_gauge() {
        let req = write_request_with_gauge("machina_host_cpu_percent", 55.5, 1_700_000_000_000);
        let body = encode_remote_write_body(&req).unwrap();
        let decoded = decode_remote_write_body(&body).unwrap();
        assert_eq!(decoded.timeseries_count, 1);
        assert_eq!(decoded.samples.len(), 1);
        assert!((decoded.samples[0].value - 55.5).abs() < 0.01);
    }

    #[test]
    fn extracts_host_triplet_from_remote_write() {
        let mut req = WriteRequest::default();
        for (name, val) in [
            ("machina_host_cpu_percent", 10.0),
            ("machina_host_memory_percent", 20.0),
            ("machina_host_disk_percent", 30.0),
        ] {
            req.timeseries.push(TimeSeries {
                labels: vec![Label {
                    name: "__name__".into(),
                    value: name.into(),
                }],
                samples: vec![Sample {
                    value: val,
                    timestamp: 1,
                }],
                exemplars: Vec::new(),
            });
        }
        let body = encode_remote_write_body(&req).unwrap();
        let decoded = decode_remote_write_body(&body).unwrap();
        let (c, m, d) = host_percents_from_remote_write(&decoded).unwrap();
        assert!((c - 10.0).abs() < 0.01);
        assert!((m - 20.0).abs() < 0.01);
        assert!((d - 30.0).abs() < 0.01);
    }

    #[test]
    fn text_parser_still_works() {
        let samples = parse_prometheus_text("machina_host_cpu_percent 1\n");
        assert_eq!(samples.len(), 1);
    }
}
