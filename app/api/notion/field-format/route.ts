import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

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

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-notion-token") || process.env.NOTION_CHARTS_TOKEN;
  const databaseId = req.nextUrl.searchParams.get("databaseId");
  const field = req.nextUrl.searchParams.get("field");

  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  if (!databaseId || !field) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const notion = getNotionClient(token);
    const db: any = await notion.databases.retrieve({ database_id: databaseId });
    const prop = db.properties[field];
    if (!prop) return NextResponse.json({ prefix: "", debug: `property "${field}" not found. Available: ${Object.keys(db.properties).join(", ")}` });

    if (prop.type === "number") {
      const fmt = prop.number?.format ?? "";
      return NextResponse.json({ prefix: NUMBER_FORMAT_PREFIX[fmt] ?? "", debug: `number format: ${fmt}` });
    }

    if (prop.type === "rollup") {
      const { relation_property_name, rollup_property_name } = prop.rollup;
      const relProp = db.properties[relation_property_name];
      if (!relProp || relProp.type !== "relation")
        return NextResponse.json({ prefix: "", debug: `relation prop "${relation_property_name}" not found or wrong type` });
      const relatedDbId: string = relProp.relation.database_id;
      if (!relatedDbId)
        return NextResponse.json({ prefix: "", debug: "no related database id" });
      const relatedDb: any = await notion.databases.retrieve({ database_id: relatedDbId });
      const targetProp = relatedDb.properties[rollup_property_name];
      if (!targetProp || targetProp.type !== "number")
        return NextResponse.json({ prefix: "", debug: `target prop "${rollup_property_name}" type: ${targetProp?.type ?? "not found"}` });
      const fmt = targetProp.number?.format ?? "";
      return NextResponse.json({ prefix: NUMBER_FORMAT_PREFIX[fmt] ?? "", debug: `rollup→number format: ${fmt}` });
    }

    return NextResponse.json({ prefix: "", debug: `prop type: ${prop.type}` });
  } catch (e: any) {
    return NextResponse.json({ prefix: "", error: e.message }, { status: 500 });
  }
}
