const API_URL = "https://apis.data.go.kr/1192136/ripCurrent/GetRipCurrentApiService";
const ALLOWED_BEACH_CODES = new Set(["HAE", "SONGJUNG"]);

function koreaDateYYYYMMDD() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}${value.month}${value.day}`;
}
function getItems(payload) {
  const candidate = payload?.response?.body?.items?.item ?? payload?.body?.items?.item ?? [];
  return Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
}
function newestByObservation(items) {
  return items.filter((item) => item && item.obsrvnDt).sort((a, b) => String(b.obsrvnDt).localeCompare(String(a.obsrvnDt)))[0] || null;
}
function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  const beachCode = String(event.queryStringParameters?.beachCode || "").toUpperCase();
  if (!ALLOWED_BEACH_CODES.has(beachCode)) return response(400, { ok: false, error: "UNSUPPORTED_BEACH" });

  const serviceKey = process.env.RIP_CURRENT_SERVICE_KEY;
  if (!serviceKey) return response(503, { ok: false, error: "DATA_UNAVAILABLE" });

  try {
    let decodedKey = serviceKey;
    try { decodedKey = decodeURIComponent(serviceKey); } catch (_) {}
    const params = new URLSearchParams({ serviceKey: decodedKey, pageNo: "1", numOfRows: "300", type: "json", beachCode, reqDate: koreaDateYYYYMMDD() });
    const apiResponse = await fetch(`${API_URL}?${params.toString()}`, { headers: { Accept: "application/json" } });
    if (!apiResponse.ok) return response(502, { ok: false, error: "DATA_UNAVAILABLE" });
    const payload = await apiResponse.json();
    const latest = newestByObservation(getItems(payload));
    if (!latest) return response(404, { ok: false, error: "NO_DATA" });

    // API 키와 원본 전체 응답은 브라우저에 전달하지 않습니다.
    return response(200, { ok: true, beachCode, data: {
      obsrvtrId: latest.obsrvtrId ?? null, obsrvtrNm: latest.obsrvtrNm ?? null,
      obsrvnDt: latest.obsrvnDt ?? null, lastScr: latest.lastScr ?? null,
      lastScrCn: latest.lastScrCn ?? null, whght: latest.whght ?? null,
      wpd: latest.wpd ?? null, wspd: latest.wspd ?? null, wndrct: latest.wndrct ?? null,
      wt: latest.wt ?? null, artmp: latest.artmp ?? null
    }});
  } catch (_) {
    return response(502, { ok: false, error: "DATA_UNAVAILABLE" });
  }
};
