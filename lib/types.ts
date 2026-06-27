export type ChartType = "line" | "bar" | "pie" | "hbar" | "doughnut" | "radar" | "kpi";

export interface ChartConfig {
  id: string;
  name: string;
  databaseId: string;
  databaseName: string;
  chartType: ChartType;
  xField: string;
  yField: string;
  yFields?: string[];
  yAggregations?: string[];
  startingPoint?: number | "auto";
  color: string;
  colorMode?: "single" | "multi";
  colors?: string[];
  createdAt: number;
}

export interface NotionDatabase {
  id: string;
  name: string;
  properties: Record<string, NotionProperty>;
}

export interface NotionProperty {
  id: string;
  name: string;
  type: string;
}
