/**
 * Minimal OpenTelemetry init (docs/03). Started as a side effect on import, before
 * the rest of the app loads. An OTLP trace exporter is configured only when
 * OTEL_EXPORTER_OTLP_ENDPOINT is set; otherwise the SDK runs as a no-op. Wrapped
 * so observability never crashes the app. Full instrumentation/dashboards: TASK-082.
 */
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | undefined;

try {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  sdk = new NodeSDK(
    endpoint
      ? { traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }) }
      : {},
  );
  sdk.start();
} catch (err) {
  console.error(
    '[otel] initialization failed:',
    err instanceof Error ? err.message : String(err),
  );
}

process.once('SIGTERM', () => {
  void sdk?.shutdown();
});
