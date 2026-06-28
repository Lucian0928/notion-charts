import { getNotionClient } from "./notion";

export function extractValue(prop: any): string | number | null {
  if (!prop) return null;
  switch (prop.type) {
    case "title":        return prop.title?.[0]?.plain_text || null;
    case "rich_text":    return prop.rich_text?.[0]?.plain_text || null;
    case "number":       return prop.number ?? null;
    case "date":         return prop.date?.start || null;
    case "checkbox":     return prop.checkbox ? 1 : 0;
    case "select":       return prop.select?.name || null;
    case "multi_select": return prop.multi_select?.map((o: any) => o.name).join(", ") || null;
    case "status":       return prop.status?.name || null;
    case "people":       return prop.people?.[0]?.name || null;
    case "url":          return prop.url || null;
    case "email":        return prop.email || null;
    case "phone_number": return prop.phone_number || null;
    case "created_by":   return prop.created_by?.name || null;
    case "last_edited_by": return prop.last_edited_by?.name || null;
    case "relation":     return prop.relation?.length ?? null;
    case "unique_id":    return prop.unique_id?.number ?? null;
    case "files":        return prop.files?.length > 0 ? prop.files.length : null;
    case "formula": {
      const f = prop.formula;
      if (f?.type === "number")  return f.number ?? null;
      if (f?.type === "string")  return f.string || null;
      if (f?.type === "boolean") return f.boolean ? 1 : 0;
      if (f?.type === "date")    return f.date?.start || null;
      return null;
    }
    case "rollup": {
      const r = prop.rollup;
      if (r?.type === "number") return r.number ?? null;
      if (r?.type === "date")   return r.date?.start || null;
      if (r?.type === "array" && Array.isArray(r.array)) {
        const nums = r.array
          .map((item: any) => extractValue(item))
          .filter((v: any) => typeof v === "number");
        return nums.length > 0 ? nums.reduce((a: number, b: number) => a + b, 0) : null;
      }
      return null;
    }
    case "created_time":     return prop.created_time || null;
    case "last_edited_time": return prop.last_edited_time || null;
    default: return null;
  }
}

export async function queryAllPages(notion: any, databaseId: string): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

// Bypasses Notion API's rollup truncation by directly querying the related
// database and computing the aggregation ourselves over ALL records.
export async function resolveRollupByDirectQuery(
  notion: any,
  databaseId: string,
  pages: any[],
  xField: string,
  yField: string,
): Promise<{ x: any; y: any }[] | null> {
  try {
    const db: any = await notion.databases.retrieve({ database_id: databaseId });
    const rollupProp = db.properties[yField];
    if (rollupProp?.type !== "rollup") return null;

    const {
      relation_property_name: relationFieldName,
      rollup_property_name:   aggregateFieldName,
      function: fn,
    } = rollupProp.rollup;

    const relationProp = db.properties[relationFieldName];
    if (relationProp?.type !== "relation") return null;

    const relatedDbId: string = relationProp.relation.database_id;
    // The synced (reverse) relation field in the related DB — only present for dual_property relations
    const reverseFieldName: string | undefined =
      relationProp.relation.dual_property?.synced_property_name;

    if (!relatedDbId || !reverseFieldName) return null;

    // Fetch ALL records from the related database with proper pagination
    const relatedPages = await queryAllPages(notion, relatedDbId);

    // Group aggregate values by parent page ID
    const grouped = new Map<string, number[]>();
    for (const rPage of relatedPages) {
      const backRel = rPage.properties[reverseFieldName];
      if (backRel?.type !== "relation") continue;

      // A related record can belong to one or more parent pages
      for (const ref of backRel.relation ?? []) {
        const parentId: string = ref.id;
        const val = extractValue(rPage.properties[aggregateFieldName]);
        if (typeof val !== "number") continue;
        if (!grouped.has(parentId)) grouped.set(parentId, []);
        grouped.get(parentId)!.push(val);
      }
    }

    const aggregate = (vals: number[]): number | null => {
      if (vals.length === 0) return 0;
      switch (fn) {
        case "sum":                  return vals.reduce((a, b) => a + b, 0);
        case "average":              return vals.reduce((a, b) => a + b, 0) / vals.length;
        case "min":                  return Math.min(...vals);
        case "max":                  return Math.max(...vals);
        case "count_all":
        case "count_values":
        case "count_unique_values":  return vals.length;
        default:                     return vals.reduce((a, b) => a + b, 0);
      }
    };

    return pages
      .map((page) => ({
        x: extractValue(page.properties[xField]),
        y: aggregate(grouped.get(page.id) ?? []),
      }))
      .filter((d) => d.x !== null && d.y !== null);
  } catch {
    return null;
  }
}

// Fetches data for a chart, correctly handling rollup fields
export async function fetchChartData(
  token: string,
  databaseId: string,
  xField: string,
  yField: string,
): Promise<{ x: any; y: any }[]> {
  const notion = getNotionClient(token);
  const pages = await queryAllPages(notion, databaseId);

  const yIsRollup = pages.length > 0 && pages[0].properties[yField]?.type === "rollup";

  if (yIsRollup) {
    const resolved = await resolveRollupByDirectQuery(notion, databaseId, pages, xField, yField);
    if (resolved) return resolved;
  }

  return pages
    .map((page: any) => ({
      x: extractValue(page.properties[xField]),
      y: extractValue(page.properties[yField]),
    }))
    .filter((d) => d.x !== null && d.y !== null);
}

export function applyAggregation(
  rawData: { x: any; y: any }[],
  aggregation: string,
): { x: any; y: any }[] {
  if (!rawData.length) return rawData;

  const orderMap = new Map<string, { x: any; vals: number[] }>();
  for (const d of rawData) {
    const key = String(d.x);
    if (!orderMap.has(key)) orderMap.set(key, { x: d.x, vals: [] });
    const val = Number(d.y);
    if (!isNaN(val)) orderMap.get(key)!.vals.push(val);
  }
  const groups = [...orderMap.values()].sort((a, b) =>
    String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0
  );

  switch (aggregation) {
    case "average":
      return groups.map(({ x, vals }) => ({ x, y: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0 }));
    case "count":
      return groups.map(({ x, vals }) => ({ x, y: vals.length }));
    case "cumulative": {
      let running = 0;
      return groups.map(({ x, vals }) => { running += vals.reduce((s, v) => s + v, 0); return { x, y: running }; });
    }
    default: // sum
      return groups.map(({ x, vals }) => ({ x, y: vals.reduce((s, v) => s + v, 0) }));
  }
}

const NUMBER_FORMAT_PREFIX: Record<string, string> = {
  dollar: "$", canadian_dollar: "CA$", singapore_dollar: "S$",
  euro: "€", pound: "£", yen: "¥", ruble: "₽", rupee: "₹", won: "₩",
  yuan: "¥", real: "R$", lira: "₺", rupiah: "Rp", franc: "CHF",
  hong_kong_dollar: "HK$", new_zealand_dollar: "NZ$", rand: "R",
  new_taiwan_dollar: "NT$", mexican_peso: "MX$", chilean_peso: "CLP$",
  philippine_peso: "₱", dirham: "AED", colombian_peso: "COP$",
  riyal: "﷼", ringgit: "RM", leu: "lei", argentine_peso: "ARS$",
  uruguayan_peso: "UYU", danish_krone: "kr", norwegian_krone: "kr",
  krona: "kr", zloty: "zł", baht: "฿", forint: "Ft", koruna: "Kč", shekel: "₪",
};

export async function fetchFieldFormat(
  token: string,
  databaseId: string,
  fieldName: string,
): Promise<{ prefix: string }> {
  try {
    const notion = getNotionClient(token);
    const db: any = await notion.databases.retrieve({ database_id: databaseId });
    const prop = db.properties[fieldName];
    if (!prop) return { prefix: "" };

    if (prop.type === "number") {
      return { prefix: NUMBER_FORMAT_PREFIX[prop.number?.format ?? ""] ?? "" };
    }
    if (prop.type === "rollup") {
      const { relation_property_name, rollup_property_name } = prop.rollup;
      const relProp = db.properties[relation_property_name];
      if (relProp?.type !== "relation") return { prefix: "" };
      const relatedDbId: string = relProp.relation.database_id;
      if (!relatedDbId) return { prefix: "" };
      const relatedDb: any = await notion.databases.retrieve({ database_id: relatedDbId });
      const targetProp = relatedDb.properties[rollup_property_name];
      if (targetProp?.type !== "number") return { prefix: "" };
      return { prefix: NUMBER_FORMAT_PREFIX[targetProp.number?.format ?? ""] ?? "" };
    }
    return { prefix: "" };
  } catch {
    return { prefix: "" };
  }
}

export async function fetchChartDataMulti(
  token: string,
  databaseId: string,
  xField: string,
  yFields: string[],
  aggregations?: string[],
): Promise<Record<string, any>[]> {
  const seriesData = await Promise.all(
    yFields.map(async (yf, i) => {
      const raw = await fetchChartData(token, databaseId, xField, yf);
      return applyAggregation(raw, aggregations?.[i] || "sum");
    })
  );
  const byX: Record<string, Record<string, any>> = {};
  for (let i = 0; i < yFields.length; i++) {
    for (const point of seriesData[i]) {
      const key = String(point.x);
      if (!byX[key]) byX[key] = { x: point.x };
      byX[key][yFields[i]] = point.y;
    }
  }
  return Object.values(byX).sort((a, b) =>
    String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0
  );
}
