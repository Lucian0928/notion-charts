export type ChartType = "line" | "bar" | "pie";

export interface ChartConfig {
  id: string;
  notionId?: string;
  name: string;
  databaseId: string;
  databaseName: string;
  chartType: ChartType;
  xField: string;
  yField: string;
  color: string;
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
