type TelemetryPayload = {
  [key: string]: string | number | boolean | null | undefined;
};

export async function postTelemetry(
  endpoint: string,
  payload: TelemetryPayload,
  token?: string
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(endpoint, {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      method: "POST",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Telemetry endpoint returned HTTP ${response.status}.`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
